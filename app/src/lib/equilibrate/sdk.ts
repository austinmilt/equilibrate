import * as anchor from "@project-serum/anchor";
import { Connection, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { Equilibrate } from "../../../../target/types/equilibrate";
import {
    ASSOCIATED_TOKEN_PROGRAM_ID,
    ENTRY_FEE_MIN_EXCLUSIVE,
    GAME_BUCKETS_MAX,
    GAME_BUCKETS_MIN,
    GAME_MAX_PLAYERS_MAX,
    GAME_MAX_PLAYERS_MIN,
    PLAYER_BUCKET_INDEX_MIN,
    PROGRAM_FEE_DESTINATION,
    RENT_SYSVAR,
    SPILL_RATE_MIN_EXCLUSIVE,
    SYSTEM_PROGRAM_ID,
    TOKEN_PROGRAM_ID
} from "./constants";
import { EventCallback, EventEmitter } from "./events";
import { Bucket, Game, GameConfig } from "./types";
import {
    getAssociatedTokenAddress,
    getGame,
    getGameAddress,
    getMintDecimals,
    getPlayerStateAddress,
    getPoolManagerAddress,
    getTokenPoolAddress
} from "./utils";
import { NATIVE_MINT } from "@solana/spl-token";

export interface SubmitTransactionFunction {
  (transaction: Transaction, connection: Connection): Promise<string>;
}

/**
 * Event emitted to listeners when a watched game receives an update.
 */
export interface GameEvent {
    /**
     * Current game account.
     */
    game: Game | null;

    /**
     * Will be defined and `true` when the current event is a new game.
     */
    new?: boolean;

    /**
     * Will be defined when the current event is a player entering the game.
     */
    enter?: {
        /**
         * Bucket index that the player entered.
         */
        bucketIndex: number;
    };

    /**
     * Will be defined when the current event is a player moving buckets.
     */
    move?: {
        /**
         * Bucket index the player moved from.
         */
        oldBucketIndex: number;

        /**
         * Bucket index the player moved to.
         */
        newBucketIndex: number;
    };

    /**
     * Will be defined when the current event is a player leaving the game.
     */
    leave?: {

        /**
         * Bucket index of the bucket the player left.
         */
        bucketIndex: number;

        /**
         * Token winnings the player took with them.
         */
        winningsDecimalTokens: number;
    };

    /**
     * Will be defined when the current event is the game being ended (last player leaves).
     */
    end?: {
        /**
         * Bucket index of the bucket the last player was in.
         */
        bucketIndex: number;

        /**
         * Token winnings the player took with them.
         */
        winningsDecimalTokens: number;
    };
}

export type GameEventCallback = EventCallback<GameEvent>

interface Subscription<T> {
    emitter: EventEmitter<T>;
    id: number;
}


/**
 * SDK for interacting with the on-chain program. You should not need any other
 * solana dependencies for any actions associated with the game.
 */
export class EquilibrateSDK {
    // we allow these to be undefined so that on startup we
    // dont have to deal with null checks
    private readonly program: anchor.Program<Equilibrate> | undefined;
    private readonly subscriptions: Map<string, Subscription<GameEvent>> = new Map<string, Subscription<GameEvent>>();
    private readonly games: Map<string, Game> = new Map<string, Game>();

    private constructor(program: anchor.Program<Equilibrate> | undefined) {
        this.program = program;
    }


    /**
     * @returns an instantiated but uninitialized SDK instance, e.g. for app startup before
     * the user has signed in
     */
    public static dummy(): EquilibrateSDK {
        return new EquilibrateSDK(undefined);
    }


    /**
     * @param program game program
     * @returns instantiated SDK ready to be used
     */
    public static from(program: anchor.Program<Equilibrate>): EquilibrateSDK {
        return new EquilibrateSDK(program);
    }


    /**
     * @returns true if the SDK is ready to be used to make requests
     */
    public isReady(): boolean {
        return this.program != null;
    }


    /**
     * @returns a new request builder for a single request (multiple instructions) to the chain
     */
    public request(): EquilibrateRequest {
        Assert.notNullish(this.program, "program");
        return EquilibrateRequest.new(this.program);
    }


    /**
     * Subscribes to changes to the given game, calling the callback whenever an update is received.
     *
     * @param gameAddress game to start watching
     * @param callback callback to call with game state whenever an update is received
     * @throws if this is a dummy SDK instance
     */
    public watchGame(gameAddress: PublicKey, callback: GameEventCallback): () => void {
        const subscription: Subscription<GameEvent> = this.addOrGetSubscription(gameAddress);
        return subscription.emitter.subscribe(callback);
    }


    private addOrGetSubscription(gameAddress: PublicKey): Subscription<GameEvent> {
        Assert.notNullish(this.program, "program");
        const gameAddressString: string = gameAddress.toBase58();
        let subscription: Subscription<GameEvent> | undefined = this.subscriptions.get(gameAddressString);
        if (subscription !== undefined) {
            return subscription;
        }

        const program: anchor.Program<Equilibrate> = this.program;
        const connection: Connection = this.program.provider.connection;
        const emitter: EventEmitter<GameEvent> = new EventEmitter();
        const listenerId: number = connection.onAccountChange(gameAddress, (buffer) => {
            let game: Game | null = null;
            if (buffer != null && buffer.data.length > 0) {
                game = program.coder.accounts.decode<Game>("Game", buffer.data);
            }
            this.processAndEmitGameEvent(gameAddress, game, emitter);
        });
        subscription = { emitter: emitter, id: listenerId };
        this.subscriptions.set(gameAddressString, subscription);
        return subscription;
    }


    private processAndEmitGameEvent(gameAddress: PublicKey, game: Game | null, emitter: EventEmitter<GameEvent>): void {
        const gameAddressString: string = gameAddress.toBase58();
        const gameBefore: Game | undefined = this.games.get(gameAddressString);
        const event: GameEvent = { game: game };
        if (game === null) {
            if (gameBefore === undefined) {
                throw new Error(`Game ${gameAddressString} never existed.`);
            }
            const winnings: number = gameBefore.state.buckets.reduce((sum, bucket) =>
                sum + bucket.decimalTokens.toNumber(), 0
            );
            const playerIndexZeroed: number = gameBefore.state.buckets.slice(1).findIndex(b => b.players > 0);
            if (playerIndexZeroed === -1) {
                throw new Error("Unable to determine the bucket of the last player.");
            }
            event.end = {
                // the zero-th bucket is the holding bucket which keeps track of the total
                // number of players in the game. We skip that looking for the player, but
                // want to start with the playable buckets at index 1, so add that back in
                // (see `slice` above where we omit the holding bucket.)
                bucketIndex: playerIndexZeroed + 1,
                winningsDecimalTokens: winnings,
            };
            // the game is over, so stop keeping track of it
            this.games.delete(gameAddressString);

        } else if (gameBefore === undefined) {
            event.new = true;
            this.games.set(gameAddressString, game);

        } else {
            const bucketsBefore: Bucket[] = gameBefore.state.buckets;
            const bucketsNow: Bucket[] = game.state.buckets;
            const playerCountChange: number = bucketsNow[0].players - bucketsBefore[0].players;
            const bucketPlayerCountChanges: number[] = bucketsNow.map((b, i) => b.players - bucketsBefore[i].players);
            if (playerCountChange === 0) {
                const bucketLeftIndex: number = this.getBucketLeftIndex(bucketPlayerCountChanges);
                const bucketEnteredIndex: number = this.getBucketEnteredIndex(bucketPlayerCountChanges);
                event.move = {
                    newBucketIndex: bucketEnteredIndex,
                    oldBucketIndex: bucketLeftIndex
                };
            } else if (playerCountChange > 0) {
                const bucketEnteredIndex: number = this.getBucketEnteredIndex(bucketPlayerCountChanges);
                event.enter = {
                    bucketIndex: bucketEnteredIndex
                };
            } else {
                const bucketLeftIndex: number = this.getBucketLeftIndex(bucketPlayerCountChanges);
                const balanceBefore: number = bucketsBefore[bucketLeftIndex].decimalTokens.toNumber();
                const balanceNow: number = bucketsNow[bucketLeftIndex].decimalTokens.toNumber();
                const winnings: number = balanceBefore - balanceNow;
                event.leave = {
                    bucketIndex: bucketLeftIndex,
                    winningsDecimalTokens: winnings
                };
            }
            this.games.set(gameAddressString, game);
        }
        emitter.emit(event);
    }


    private getBucketLeftIndex(bucketPlayerCountChanges: number[]): number {
        const index: number = bucketPlayerCountChanges.findIndex(c => c < 0);
        if (index === -1) {
            throw new Error("Unable to determine bucket left");
        }
        return index;
    }


    private getBucketEnteredIndex(bucketPlayerCountChanges: number[]): number {
        const index: number = bucketPlayerCountChanges.findIndex(c => c > 0);
        if (index === -1) {
            throw new Error("Unable to determine bucket entered");
        }
        return index;
    }


    /**
     * Stops watching the given game, meaning all registered callbacks will cease to work.
     *
     * Does nothing if the game isnt being watched.
     *
     * @param gameAddress game to stop watching
     * @throws if this is a dummy SDK instance
     */
    public async stopWatchingGame(gameAddress: PublicKey): Promise<void> {
        Assert.notNullish(this.program, "program");
        const gameAddressString: string = gameAddress.toBase58();
        const subscription: Subscription<GameEvent> | undefined = this.subscriptions.get(gameAddressString);
        if (subscription !== undefined) {
            subscription.emitter.unsubscribeAll();
            await this.program.provider.connection.removeAccountChangeListener(subscription.id);
            this.subscriptions.delete(gameAddressString);
        }
    }
}


/**
 * Request builder and runner for single requests to the chain. Use like
 *
 * ```
 * const transactionId: string = await sdk.request()
 *    .setMint(mintAddress)
 *    .setPlayerBucketIndex(bucketIndex)
 *    .setGameId(gameId)
 *    .withInstructions(...someArbitraryInstructions)
 *    .withEnterGame()
 *    .signAndSend();
 * ```
 */
export class EquilibrateRequest {
    private readonly program: anchor.Program<Equilibrate>;
    private readonly connection: Connection;
    private readonly steps: (() => Promise<TransactionInstruction[]>)[] = [];
    private readonly config: {
        mint?: PublicKey;
        entryFee?: number;
        spillRateTokensPerSecondPerPlayer?: number;
        nBuckets?: number;
        maxPlayers?: number;
    } = {};
    private bucketIndex: number | undefined;
    private gameId: number | undefined;
    private cancelOnLoss: boolean | undefined;

    private constructor(program: anchor.Program<Equilibrate>) {
        this.program = program;
        this.connection = program.provider.connection;
    }

    public static new(program: anchor.Program<Equilibrate>): EquilibrateRequest {
        return new EquilibrateRequest(program);
    }


    /**
     * Sets the game mint.
     *
     * @param mint game mint
     * @returns this request
     */
    public setMint(mint: PublicKey): EquilibrateRequest {
        this.config.mint = mint;
        return this;
    }


    /**
     * Sets the entry fee for a new game.
     *
     * @param entryFee entry fee in normal units (not whole-number decimal units)
     * @returns this request
     * @throws if the entry fee is too small
     */
    public setEntryFee(entryFee: number): EquilibrateRequest {
        Assert.greaterThan(entryFee, ENTRY_FEE_MIN_EXCLUSIVE, "entryFee");
        this.config.entryFee = entryFee;
        return this;
    }


    /**
     * Sets the spill rate for a new game.
     *
     * @param spillRateTokensPerSecondPerPlayer spill rate in normal units (not whole-number decimal units) of
     * tokens per second per player (in a bucket)
     * @returns this request
     * @throws if the spill rate is too low
     */
    public setSpillRate(spillRateTokensPerSecondPerPlayer: number): EquilibrateRequest {
        Assert.greaterThan(
            spillRateTokensPerSecondPerPlayer,
            SPILL_RATE_MIN_EXCLUSIVE,
            "spillRateTokensPerSecondPerPlayer"
        );
        this.config.spillRateTokensPerSecondPerPlayer = spillRateTokensPerSecondPerPlayer;
        return this;
    }


    /**
     * Sets the number of buckets for a new game.
     *
     * @param nBuckets number of buckets
     * @returns this request
     * @throws if the number of buckets is too small or too large
     */
    public setNumberOfBuckets(nBuckets: number): EquilibrateRequest {
        Assert.greaterThanOrEqualTo(nBuckets, GAME_BUCKETS_MIN, "nBuckets");
        Assert.lessThanOrEqualTo(nBuckets, GAME_BUCKETS_MAX, "nBuckets");
        this.config.nBuckets = nBuckets;
        return this;
    }


    /**
     * Sets the maximum number of players for a new game.
     *
     * @param maxPlayers
     * @returns this request
     * @throws if the value is too low or too high
     */
    public setMaxPlayers(maxPlayers: number): EquilibrateRequest {
        Assert.greaterThanOrEqualTo(maxPlayers, GAME_MAX_PLAYERS_MIN, "maxPlayers");
        Assert.lessThanOrEqualTo(maxPlayers, GAME_MAX_PLAYERS_MAX, "maxPlayers");
        this.config.maxPlayers = maxPlayers;
        return this;
    }


    /**
     * Sets the player bucket index for the player to enter or move to.
     *
     * Note this does not validate that the player attempts to enter a bucket
     * beyond the last one, but the program will do so. The upper bound should
     * be limited externally to this SDK.
     *
     * Note: the player cannot enter the 0th-bucket, which is a reserved bucket
     *
     * @param bucketIndex bucket index for the player to enter
     * @returns this request
     * @throws if the value is too low
     */
    public setPlayerBucketIndex(bucketIndex: number): EquilibrateRequest {
        Assert.greaterThanOrEqualTo(bucketIndex, PLAYER_BUCKET_INDEX_MIN, "bucketIndex");
        this.bucketIndex = bucketIndex;
        return this;
    }


    /**
     * Sets the game ID to the game being played.
     *
     * @param gameId game ID of the game being played
     * @returns this request
     */
    public setGameId(gameId: number): EquilibrateRequest {
        this.gameId = gameId;
        return this;
    }


    /**
     * Sets the flag indicating if leaving the game should be aborted if the
     * player would lose tokens.
     *
     * @param cancelOnLoss set to true to abort leaving the game if the player would lose tokens
     * @returns this request
     */
    public setCancelOnLoss(cancelOnLoss: boolean): EquilibrateRequest {
        this.cancelOnLoss = cancelOnLoss;
        return this;
    }


    /**
     * Adds instruction to create a new game. Will also add an instruction to create
     * the token pool/manager if one doesnt already exist.
     *
     * @returns this request
     * @throws if any of the following have not been set: `mint`, `entryFeeDecimalTokens`,
     * `spillRateDecimalTokensPerSecondPerPlayer`, `nBuckets`, `maxPlayers`
     */
    public withCreateNewGame(): EquilibrateRequest {
        this.validateConfig();
        Assert.notNullish(this.program.provider.publicKey, "player");
        const player: PublicKey = this.program.provider.publicKey;
        this.steps.push(async () => {
            const config: GameConfig = await this.finalizeConfig();
            // first determine if we need to create the token pool/manager
            // before making the game
            const [poolManagerAddress, poolManagerBump] = await getPoolManagerAddress(
                config.mint,
                this.program.programId
            );
            const poolManagerExists: boolean = (await this.connection.getAccountInfo(
                poolManagerAddress
            )) != null;
            const tokenPoolAddress: PublicKey = await getTokenPoolAddress(
                config.mint,
                this.program.programId
            );
            const tokenPoolExists: boolean = (await this.program.provider.connection.getAccountInfo(
                tokenPoolAddress
            )) != null;

            const instructions: TransactionInstruction[] = [];
            if (!poolManagerExists && !tokenPoolExists) {
                const createPoolInstruction: TransactionInstruction = await this.program
                    .methods
                    .createPool(poolManagerBump)
                    .accountsStrict({
                        poolManager: poolManagerAddress,
                        tokenPool: tokenPoolAddress,
                        payer: player,
                        gameMint: config.mint,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        rent: RENT_SYSVAR,
                        systemProgram: SYSTEM_PROGRAM_ID
                    })
                    .instruction();

                instructions.push(createPoolInstruction);
            } else if ((!poolManagerExists && tokenPoolExists) || (poolManagerExists && !tokenPoolExists)) {
                throw new Error("Cant make game, both pool manager and token pool must exist or we must create them");
            }

            const shouldAddUnwrapSolInstruction: boolean = await this.addWrapSolInstructionsIfNeeded(instructions);

            const gameId: number = this.gameId ?? this.generateGameId();
            const gameAddress: PublicKey = await getGameAddress(gameId, this.program.programId);
            const playerStateAddress: PublicKey = await getPlayerStateAddress(
                gameAddress,
                player,
                this.program.programId
            );
            const playerTokenAccount: PublicKey = await getAssociatedTokenAddress(config.mint, player);
            const newGameInstruction: TransactionInstruction = await this.program
                .methods
                .newGame(
                    config,
                    new anchor.BN(gameId),
                    poolManagerAddress
                )
                .accountsStrict({
                    tokenPool: tokenPoolAddress,
                    payer: player,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    rent: RENT_SYSVAR,
                    systemProgram: SYSTEM_PROGRAM_ID,
                    game: gameAddress,
                    firstPlayer: playerStateAddress,
                    programFeeDestination: PROGRAM_FEE_DESTINATION,
                    depositSourceAccount: playerTokenAccount,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
                })
                .instruction();

            instructions.push(newGameInstruction);

            if (shouldAddUnwrapSolInstruction) {
                await this.addCloseTokenAccountInstruction(instructions);
            }

            return instructions;
        });

        return this;
    }


    private validateConfig(): void {
        Assert.notNullish(this.config.mint, "mint");
        Assert.notNullish(this.config.entryFee, "entryFee");
        Assert.notNullish(
            this.config.spillRateTokensPerSecondPerPlayer,
            "spillRateTokensPerSecondPerPlayer"
        );
        Assert.notNullish(this.config.nBuckets, "nBuckets");
        Assert.notNullish(this.config.maxPlayers, "maxPlayers");
    }


    private async finalizeConfig(): Promise<GameConfig> {
        Assert.notNullish(this.config.mint, "mint");
        Assert.notNullish(
            this.config.spillRateTokensPerSecondPerPlayer,
            "spillRateTokensPerSecondPerPlayer"
        );
        Assert.notNullish(this.config.nBuckets, "nBuckets");
        Assert.notNullish(this.config.maxPlayers, "maxPlayers");
        const mintToDecimalMultiplier: number = await this.computeMintToDecimalMultiplier();
        const entryFeeWithDecimals: anchor.BN = await this.computeEntryFeeDecimalTokens(mintToDecimalMultiplier);
        const spillRateWithDecimals: anchor.BN = new anchor.BN(
            this.config.spillRateTokensPerSecondPerPlayer * mintToDecimalMultiplier
        );

        return {
            mint: this.config.mint,
            entryFeeDecimalTokens: entryFeeWithDecimals,
            spillRateDecimalTokensPerSecondPerPlayer: spillRateWithDecimals,
            nBuckets: this.config.nBuckets,
            maxPlayers: this.config.maxPlayers
        };
    }


    private async computeMintToDecimalMultiplier(): Promise<number> {
        Assert.notNullish(this.config.mint, "mint");
        const mintDecimals: number = await getMintDecimals(this.config.mint, this.connection);
        return Math.pow(10, mintDecimals);
    }


    private async computeEntryFeeDecimalTokens(mintToDecimalMultiplier: number): Promise<anchor.BN> {
        Assert.notNullish(this.config.entryFee, "entryFee");
        return new anchor.BN(this.config.entryFee * mintToDecimalMultiplier);
    }


    private generateGameId(): number {
        // All we need is to ensure that each game is unique,
        // and using the epoch time in milliseconds will with very high
        // likelihood produce this result, while also conveniently
        // making games sequentially ordered
        return new Date().getTime();
    }


    /**
     * Solana native mint is the one exception where the player doesnt need to already have
     * the mint in order to transfer tokens in/out, since it can be wrapped and transferred
     * from their wallet. Every other mint would need to be created already for them to
     * have enough to play the game, and we can let the transaction simulation handle that error
     * case.
     *
     * @param instructions instructions to append to
     * @returns boolean flag if the instructions should be followed up with an unwrap instruction
     */
    private async addWrapSolInstructionsIfNeeded(instructions: TransactionInstruction[]): Promise<boolean> {
        Assert.notNullish(this.config.mint, "mint");
        const mint: PublicKey = this.config.mint;

        let result: boolean = false;
        if (mint.toBase58() === NATIVE_MINT.toBase58()) {
            Assert.notNullish(this.program.provider.publicKey, "player");
            Assert.notNullish(this.config.entryFee, "entryFee");
            const player: PublicKey = this.program.provider.publicKey;
            const playerTokenAccount: PublicKey = await getAssociatedTokenAddress(mint, player);
            const mintToDecimalMultiplier: number = await this.computeMintToDecimalMultiplier();
            const entryFeeWithDecimals: anchor.BN = await this.computeEntryFeeDecimalTokens(mintToDecimalMultiplier);
            const nativeTokenAccountExists: boolean = await this.accountExists(playerTokenAccount);

            if (!nativeTokenAccountExists) {
                instructions.push(await this.makeCreateTokenAccountInstruction(mint, player, playerTokenAccount));

                const depositSolInstruction: TransactionInstruction = anchor.web3
                    .SystemProgram
                    .transfer({
                        fromPubkey: player,
                        toPubkey: playerTokenAccount,
                        lamports: entryFeeWithDecimals.toNumber()
                    });

                instructions.push(depositSolInstruction);

                const syncNativeInstruction: TransactionInstruction = await anchor.Spl
                    .token(this.program.provider)
                    .methods
                    .syncNative()
                    .accountsStrict({
                        account: playerTokenAccount
                    })
                    .instruction();

                instructions.push(syncNativeInstruction);
            }

            result = !nativeTokenAccountExists;
        }
        return result;
    }


    private async makeCreateTokenAccountInstruction(
        mint: PublicKey,
        owner: PublicKey,
        tokenAccount: PublicKey
    ): Promise<TransactionInstruction> {
        return await anchor.Spl
            .associatedToken(this.program.provider)
            .methods
            .create()
            .accountsStrict({
                mint: mint,
                owner: owner,
                authority: owner,
                associatedAccount: tokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
                rent: RENT_SYSVAR,
                systemProgram: SYSTEM_PROGRAM_ID
            })
            .instruction();
    }


    private async addCloseTokenAccountInstruction(instructions: TransactionInstruction[]): Promise<void> {
        Assert.notNullish(this.program.provider.publicKey, "player");
        Assert.notNullish(this.config.mint, "mint");
        const mint: PublicKey = this.config.mint;

        if (mint.toBase58() === NATIVE_MINT.toBase58()) {
            Assert.notNullish(this.program.provider.publicKey, "player");
            Assert.notNullish(this.config.entryFee, "entryFee");
            const player: PublicKey = this.program.provider.publicKey;
            const playerTokenAccount: PublicKey = await getAssociatedTokenAddress(mint, player);
            const instruction: TransactionInstruction = await anchor.Spl
                .token(this.program.provider)
                .methods
                .closeAccount()
                .accountsStrict({
                    authority: player,
                    account: playerTokenAccount,
                    destination: player
                })
                .instruction();

            instructions.push(instruction);
        }
    }


    private async accountExists(account: PublicKey): Promise<boolean> {
        const tokenAccountInfo: anchor.web3.AccountInfo<Buffer> | null = await this.connection
            .getAccountInfo(account);

        return (tokenAccountInfo !== null) && (tokenAccountInfo.data.length > 0);
    }


    /**
     * Adds instruction to enter an existing game as a new player.
     *
     * @returns this request
     * @throws if any of the following have not been set: `mint`, `bucketIndex`, `gameId`
     */
    public withEnterGame(): EquilibrateRequest {
        Assert.notNullish(this.bucketIndex, "bucketIndex");
        Assert.notNullish(this.config.mint, "mint");
        Assert.notNullish(this.gameId, "gameId");
        Assert.notNullish(this.program.provider.publicKey, "player");
        const bucketIndex: number = this.bucketIndex;
        const mint: PublicKey = this.config.mint;
        const gameId: number = this.gameId;
        const player: PublicKey = this.program.provider.publicKey;
        this.steps.push(async () => {
            const instructions: TransactionInstruction[] = [];

            const playerTokenAccount: PublicKey = await getAssociatedTokenAddress(mint, player);
            const shouldCreateAndCloseTokenAccount = !this.accountExists(playerTokenAccount);
            if (shouldCreateAndCloseTokenAccount) {
                // really the only time we should get here is if playing with SOL, such that we
                // already created and closed the wrapped SOL account to create or enter the game
                instructions.push(await this.makeCreateTokenAccountInstruction(mint, player, playerTokenAccount));
            }

            const poolManagerAddress: PublicKey = (await getPoolManagerAddress(mint, this.program.programId))[0];
            const tokenPoolAddress: PublicKey = await getTokenPoolAddress(
                mint,
                this.program.programId
            );
            const gameAddress: PublicKey = await getGameAddress(gameId, this.program.programId);
            const playerStateAddress: PublicKey = await getPlayerStateAddress(
                gameAddress,
                player,
                this.program.programId
            );
            const instruction: TransactionInstruction = await this.program
                .methods
                .enterGame(
                    bucketIndex,
                    poolManagerAddress
                )
                .accountsStrict({
                    game: gameAddress,
                    programFeeDestination: PROGRAM_FEE_DESTINATION,
                    depositSourceAccount: playerTokenAccount,
                    tokenPool: tokenPoolAddress,
                    payer: player,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SYSTEM_PROGRAM_ID,
                    rent: RENT_SYSVAR,
                    player: playerStateAddress
                })
                .instruction();

            instructions.push(instruction);

            if (shouldCreateAndCloseTokenAccount) {
                this.addCloseTokenAccountInstruction(instructions);
            }

            return instructions;
        });

        return this;
    }


    /**
     * Adds instruction to move to a new bucket within a game.
     *
     * @returns this request
     * @throws if any of the following have not been set: `bucketIndex`, `gameId`
     */
    public withMoveBucket(): EquilibrateRequest {
        Assert.notNullish(this.bucketIndex, "bucketIndex");
        Assert.notNullish(this.gameId, "gameId");
        Assert.notNullish(this.program.provider.publicKey, "player");
        const bucketIndex: number = this.bucketIndex;
        const gameId: number = this.gameId;
        const player: PublicKey = this.program.provider.publicKey;
        this.steps.push(async () => {
            const gameAddress: PublicKey = await getGameAddress(gameId, this.program.programId);
            const playerStateAddress: PublicKey = await getPlayerStateAddress(
                gameAddress,
                player,
                this.program.programId
            );
            const instruction: TransactionInstruction = await this.program
                .methods
                .moveBuckets(bucketIndex)
                .accountsStrict({
                    game: gameAddress,
                    payer: player,
                    player: playerStateAddress
                })
                .instruction();

            return [instruction];
        });

        return this;
    }


    /**
     * Adds instruction to leave an existing game.
     *
     * @returns this request
     * @throws if any of the following have not been set: `mint`, `gameId`, `cancelOnLoss`
     */
    public withLeaveGame(): EquilibrateRequest {
        Assert.notNullish(this.config.mint, "mint");
        Assert.notNullish(this.gameId, "gameId");
        Assert.notNullish(this.cancelOnLoss, "cancelOnLoss");
        Assert.notNullish(this.program.provider.publicKey, "player");
        const mint: PublicKey = this.config.mint;
        const gameId: number = this.gameId;
        const cancelOnLoss: boolean = this.cancelOnLoss;
        const player: PublicKey = this.program.provider.publicKey;
        this.steps.push(async () => {
            const instructions: TransactionInstruction[] = [];

            const shouldAddUnwrapSolInstruction: boolean = await this.addWrapSolInstructionsIfNeeded(instructions);

            const poolManagerAddress: PublicKey = (await getPoolManagerAddress(mint, this.program.programId))[0];
            const tokenPoolAddress: PublicKey = await getTokenPoolAddress(
                mint,
                this.program.programId
            );
            const gameAddress: PublicKey = await getGameAddress(gameId, this.program.programId);
            const playerStateAddress: PublicKey = await getPlayerStateAddress(
                gameAddress,
                player,
                this.program.programId
            );
            const playerTokenAccount: PublicKey = await getAssociatedTokenAddress(mint, player);
            const game: Game = await getGame(gameAddress, this.program);
            const leaveInstruction: TransactionInstruction = await this.program
                .methods
                .leaveGame(cancelOnLoss)
                .accountsStrict({
                    game: gameAddress,
                    payer: player,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SYSTEM_PROGRAM_ID,
                    player: playerStateAddress,
                    poolManager: poolManagerAddress,
                    tokenPool: tokenPoolAddress,
                    gameCreator: game.creator,
                    winningsDestinationAccount: playerTokenAccount
                })
                .instruction();

            instructions.push(leaveInstruction);

            if (shouldAddUnwrapSolInstruction) {
                this.addCloseTokenAccountInstruction(instructions);
            }

            return instructions;
        });

        return this;
    }


    /**
     * Add arbitrary instructions to be executed atomically with others in this request.
     *
     * @param instructions instructions to add to the transaction
     * @returns this request
     */
    public withInstructions(...instructions: TransactionInstruction[]): EquilibrateRequest {
        this.steps.push(async () => instructions);
        return this;
    }


    /**
     * Signs and submits the request (collection of transaction instructions) to the chain
     *
     * @returns the transaction
     */
    public async signAndSend(simulateOnly?: boolean): Promise<string> {
        Assert.notNullish(this.program.provider.sendAndConfirm, "program.provider.sendAndConfirm");
        const transaction: Transaction = new Transaction();
        for (const step of this.steps) {
            transaction.add(...(await step()));
        }

        let result: string = "";
        if (simulateOnly) {
            Assert.notNullish(this.program.provider.publicKey, "player");
            transaction.feePayer = this.program.provider.publicKey;
            const simulationResult = await this.program.provider.connection.simulateTransaction(transaction);
            // debugging only
            // eslint-disable-next-line no-console
            console.log(simulationResult);

        } else {
            result = await this.program.provider.sendAndConfirm(
                transaction,
                undefined,
                { commitment: "confirmed" }
            );
            //TODO replace with something the user can look at
            console.log("Transaction", result);
        }
        return result;
    }
}

class Assert {
    private constructor() {
        // dont instantiate static class
    }

    public static notNullish<T>(arg: T, name: string): asserts arg is NonNullable<T> & void {
        if (arg == null) throw new Error("Must define " + name);
    }

    public static lessThan(arg: number, lessThanThis: number, name: string): void {
        if (arg >= lessThanThis) throw new Error(`${arg} (${name}) must be less than ${lessThanThis}`);
    }

    public static lessThanOrEqualTo(arg: number, lessThanOrEqualToThis: number, name: string): void {
        if (arg > lessThanOrEqualToThis) {
            throw new Error(`${arg} (${name}) must be less than or equal to ${lessThanOrEqualToThis}`);
        }
    }

    public static greaterThan(arg: number, greaterThanThis: number, name: string): void {
        if (arg <= greaterThanThis) throw new Error(`${arg} (${name}) must be greater than ${greaterThanThis}`);
    }

    public static greaterThanOrEqualTo(arg: number, greaterOrEqualToThis: number, name: string): void {
        if (arg < greaterOrEqualToThis) {
            throw new Error(`${arg} (${name}) must be greater than or equal to ${greaterOrEqualToThis}`);
        }
    }
}
