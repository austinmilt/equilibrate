import * as anchor from "@project-serum/anchor";
import {
    Connection,
    PublicKey,
    SendTransactionError,
    Transaction,
    TransactionInstruction
} from "@solana/web3.js";
import { Equilibrate } from "../../../../target/types/equilibrate";
import {
    ASSOCIATED_TOKEN_PROGRAM_ID,
    BURN_RATE_MIN,
    ENTRY_FEE_MIN_EXCLUSIVE,
    GAME_BUCKETS_MAX,
    GAME_BUCKETS_MIN,
    GAME_MAX_PLAYERS_MAX,
    GAME_MAX_PLAYERS_MIN,
    PLAYER_BUCKET_INDEX_MIN,
    PROGRAM_ERROR_ABORT_LEAVE_ON_LOSS,
    PROGRAM_FEE_DESTINATION,
    RENT_SYSVAR,
    SPILL_RATE_MIN_EXCLUSIVE,
    SYSTEM_PROGRAM_ID,
    TOKEN_PROGRAM_ID
} from "./constants";
import { EventCallback, EventEmitter } from "./events";
import {
    Bucket,
    Game,
    GameConfig,
    GameConfigEnriched,
    GameEnriched,
    GameWithEnrichedConfig,
    PlayerState,
    PlayerStateEnriched
} from "./types";
import {
    accountExists,
    getAssociatedTokenAddress,
    getGameAddress,
    getMintDecimals,
    getPlayerStateAddress,
    getPoolManagerAddress,
    getTokenPoolAddress
} from "./utils";
import { NATIVE_MINT } from "@solana/spl-token";
import { AnchorError } from "@project-serum/anchor";
import { SimpleCache } from "./cache";
import { Duration } from "../shared/duration";
import { mapGameAccountToCurrentVersion } from "./accounts";

export interface SubmitTransactionFunction {
  (transaction: Transaction, connection: Connection): Promise<string>;
}

/**
 * Event emitted to listeners when a watched game receives an update.
 */
export interface GameEvent {
    /**
     * Current game account. Will be `null` after the game ends or could not be found.
     */
    game: GameEnriched | null;

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


/**
 * Event emitted to listeners when a watched player in a specific game receives an update.
 */
export interface PlayerStateEvent {
    /**
     * Current player game account. Will be `null` if the player cannot be found.
     */
    player: PlayerStateEnriched | null;

    /**
     * Will be defined and `true` when the player creates the game.
     */
    new?: {
        /**
         * Bucket index that the player entered.
         */
        bucketIndex: number;
    };

    /**
     * Will be defined when the current event is the player entering the game.
     */
    enter?: {
        /**
         * Bucket index that the player entered.
         */
        bucketIndex: number;
    };

    /**
     * Will be defined when the current event is the player moving buckets.
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
     * Will be defined when the current event is the player leaving the game.
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
}

export type PlayerStateEventCallback = EventCallback<PlayerStateEvent>


export interface GamesListEntry {
    account: GameWithEnrichedConfig;
    publicKey: PublicKey;

    /**
     * Will be undefined if the user's wallet isnt connected.
     */
    userIsPlaying: boolean | undefined;
}


export interface RequestResult {

    /**
     * RPC transaction signature. Will be defined if the transaction succeded.
     */
    transactionSignature?: string;

    /**
     * Will be defined if an acceptable error was thrown such that the SDK should
     * not have thrown it immediately, e.g. when cancelling a LeaveGame request
     * if the player would lose money.
     */
    error?: Error;

    /**
     * Error code string of anchor error if one was thrown. Will be defined if an
     * acceptable error was thrown such that the SDK should not have thrown it
     * immediately, e.g. when cancelling a LeaveGame request if the player would
     *  lose money.
     */
    anchorErrorCode?: string;

    /**
     * Result of a simulation-only run. Will be defined if the request was simulation only.
     */
    simulationResult?: anchor.web3.SimulatedTransactionResponse;
}

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

    private readonly games: Map<string, GameEnriched> = new Map<string, GameEnriched>();
    private readonly gameSubscriptions: Map<string, Subscription<GameEvent>> =
        new Map<string, Subscription<GameEvent>>();

    private readonly playerStates: Map<string, PlayerState> = new Map<string, PlayerState>();
    private readonly playerStateSubscriptions: Map<string, Subscription<PlayerStateEvent>> =
        new Map<string, Subscription<PlayerStateEvent>>();

    private readonly mintDecimalsCache: SimpleCache<string, number> = SimpleCache.withoutTtl();
    private readonly gameExistsCache: SimpleCache<string, boolean> = SimpleCache.withTtl(Duration.ofSeconds(5));
    private readonly playerInGameCache: SimpleCache<string, boolean> = SimpleCache.withTtl(
        Duration.ofMilliseconds(1)
    );
    private readonly playerStateCache: SimpleCache<string, PlayerState | null> = SimpleCache.withTtl(
        Duration.ofMilliseconds(1),
        true
    );
    private readonly gameCache: SimpleCache<string, Game> = SimpleCache.withTtl(Duration.ofMilliseconds(50));

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
     * @param player optional player to use as the player rather than the one configured on the provider
     * @returns a new request builder for a single request (multiple instructions) to the chain
     */
    public request(player?: PublicKey): EquilibrateRequest {
        Assert.notNullish(this.program, "program");
        return EquilibrateRequest.new(this, this.program, player);
    }


    /**
     * @returns all active games
     */
    public async getGamesList(): Promise<GamesListEntry[]> {
        Assert.notNullish(this.program, "program");
        const program: anchor.Program<Equilibrate> = this.program;

        // get the mint decimals for all mints in all games
        const gamesListRaw = (await program.account.game.all()).map(g => ({
            ...g,
            account: mapGameAccountToCurrentVersion(g.account)
        }));
        const mints: Set<PublicKey> = new Set<PublicKey>();
        const mintDecimals: Map<string, number> = new Map<string, number>();
        gamesListRaw.forEach(r => mints.add(r.account.config.mint));
        await Promise.allSettled([...mints].map(mint =>
            this.getOrFetchMintDecimals(mint)
                .then(decimals => mintDecimals.set(mint.toBase58(), decimals))
                .catch(e => {
                    console.error(`Unable to retrieve mint decimals for ${mint}`, e);
                })
        ));

        // figure out which games the user is playing
        const player: PublicKey | undefined = program.provider.publicKey;
        const userIsPlaying: Map<string, boolean> = new Map<string, boolean>();
        if (player !== undefined) {
            await Promise.all(gamesListRaw.map(async (entry) => {
                try {
                    userIsPlaying.set(entry.publicKey.toBase58(), await this.playerInGame(entry.publicKey));

                } catch (e) {
                    console.error("Unable to determine if player is playing game.", e);
                }
            }));
        }

        // enrich the game objects
        const result: GamesListEntry[] = [];
        for (const rawGameContext of gamesListRaw) {
            const mint: PublicKey = rawGameContext.account.config.mint;
            const mintString: string = mint.toBase58();
            const thisMintDecimals: number | undefined = mintDecimals.get(mintString);
            const configEnriched: GameConfigEnriched = {
                ...rawGameContext.account.config,
                mintDecimals: thisMintDecimals ?? null
            };
            const accountEnriched: GameWithEnrichedConfig = {
                ...(rawGameContext.account as Game),
                config: configEnriched
            };

            result.push({
                ...rawGameContext,
                account: accountEnriched,
                userIsPlaying: userIsPlaying.get(rawGameContext.publicKey.toBase58())
            });
        }

        return result;
    }


    /**
     * @param address game to check
     * @returns true if the game exists
     */
    public async gameExists(address: PublicKey): Promise<boolean> {
        Assert.notNullish(this.program, "program");
        const connection: Connection = this.program.provider.connection;
        return await this.gameExistsCache.getOrFetch(
            address.toBase58(),
            () => accountExists(address, connection)
        );
    }


    /**
     * @param gameAddress game address to check if active player is playing
     * @param player overrides the SDK's current player to locate with the given one
     * @returns true if active player is playing this game
     */
    public async playerInGame(gameAddress: PublicKey, player?: PublicKey): Promise<boolean> {
        Assert.notNullish(this.program, "program");
        Assert.notNullish(this.program.provider.publicKey, "player");
        const playerStateAddress: PublicKey = await getPlayerStateAddress(
            gameAddress,
            player ?? this.program.provider.publicKey,
            this.program.programId
        );
        const connection: Connection = this.program.provider.connection;
        return await this.playerInGameCache.getOrFetch(
            playerStateAddress.toBase58(),
            () => accountExists(playerStateAddress, connection)
        );
    }


    /**
     * @param gameAddress address of game to check for player state
     * @param player player address to check; defaults to one on the program provider
     * @returns player state if the player is in the game, `null` otherwise
     */
    public async getPlayerState(gameAddress: PublicKey, player?: PublicKey): Promise<PlayerState | null> {
        Assert.notNullish(this.program, "program");

        const targetPlayer: PublicKey | undefined = player ?? this.program.provider.publicKey;
        Assert.notNullish(targetPlayer, "player");

        const playerStateAddress: PublicKey = await getPlayerStateAddress(
            gameAddress,
            targetPlayer,
            this.program.programId
        );

        const program: anchor.Program<Equilibrate> = this.program;
        return await this.playerStateCache.getOrFetch(
            playerStateAddress.toBase58(),
            () => program.account.playerState.fetchNullable(playerStateAddress)
        );
    }


    /**
     * Subscribes to changes to the given game, calling the callback whenever an update is received.
     *
     * @param gameAddress game to start watching
     * @param callback callback to call with game state whenever an update is received
     * @throws if this is a dummy SDK instance
     */
    public watchGame(gameAddress: PublicKey, callback: GameEventCallback, fetchNow: boolean = false): void {
        const subscription: Subscription<GameEvent> = this.addOrGetGameSubscription(gameAddress);
        subscription.emitter.subscribe(callback);

        if (fetchNow) {
            this.gameExists(gameAddress)
                .then(exists => {
                    if (exists) {
                        this.getGame(gameAddress)
                            .then(game => this.processAndEmitGameEvent(gameAddress, game, subscription.emitter));
                    }
                });
        }
    }


    /**
     * Gets the game object from on-chain. This assumes the
     * game exists (use `gameExists` to check if it exists first).
     *
     * @param address address of the game to retrieve
     * @returns game object
     */
    public async getGame(address: PublicKey): Promise<Game> {
        Assert.notNullish(this.program, "program");
        const program: anchor.Program<Equilibrate> = this.program;
        return await this.gameCache.getOrFetch(
            address.toBase58(),
            async () => mapGameAccountToCurrentVersion(await program.account.game.fetch(address))
        );
    }


    private addOrGetGameSubscription(gameAddress: PublicKey): Subscription<GameEvent> {
        Assert.notNullish(this.program, "program");
        const gameAddressString: string = gameAddress.toBase58();
        let subscription: Subscription<GameEvent> | undefined = this.gameSubscriptions.get(gameAddressString);
        if (subscription !== undefined) {
            return subscription;
        }

        const program: anchor.Program<Equilibrate> = this.program;
        const connection: Connection = this.program.provider.connection;
        const emitter: EventEmitter<GameEvent> = new EventEmitter();
        // we have to use connection.onAccountChange for accounts that may be deleted while we're watching them
        // because anchor doesnt handle that
        const listenerId: number = connection.onAccountChange(gameAddress, async (buffer) => {
            let game: Game | null = null;
            if (buffer != null && buffer.data.length > 0) {
                // The string "game" here matches the name of the game state account in the rust program.
                // For some reason we have to use a lowercase "game" here but an uppercase "Game"
                // in tests
                game = program.coder.accounts.decode<Game>("game", buffer.data);
            }
            await this.processAndEmitGameEvent(gameAddress, game, emitter);
        });
        subscription = { emitter: emitter, id: listenerId };
        this.gameSubscriptions.set(gameAddressString, subscription);
        return subscription;
    }


    private async processAndEmitGameEvent(
        gameAddress: PublicKey,
        game: Game | null,
        emitter: EventEmitter<GameEvent>
    ): Promise<void> {
        const gameAddressString: string = gameAddress.toBase58();
        const gameBefore: GameEnriched | undefined = this.games.get(gameAddressString);
        const gameNow: GameEnriched | null = await this.enrichGameObject(gameAddress, gameBefore, game);
        const event: GameEvent = { game: gameNow };
        if (gameNow === null) {
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
            this.games.set(gameAddressString, gameNow);

        } else {
            const bucketsBefore: Bucket[] = gameBefore.state.buckets;
            const bucketsNow: Bucket[] = gameNow.state.buckets;
            const playerCountChange: number = bucketsNow[0].players - bucketsBefore[0].players;
            const bucketPlayerCountChanges: number[] = bucketsNow.map((b, i) => b.players - bucketsBefore[i].players);
            if (bucketPlayerCountChanges.every(c => c === 0)) {
                // We need the player balance in a bucket to have updated to know what happened. It's possible that
                // this event was triggered manually rather than by the program, which could mean
                // that nothing has actually changed. In fact, this should be the only possibility
                // since the only updates to the game account come when someone leaves, enters,
                // or moves buckets, all of which would affect the bucket player balances.

            } else if (playerCountChange === 0) {
                try {
                    const bucketLeftIndex: number = this.getBucketLeftIndex(bucketPlayerCountChanges);
                    const bucketEnteredIndex: number = this.getBucketEnteredIndex(bucketPlayerCountChanges);
                    event.move = {
                        newBucketIndex: bucketEnteredIndex,
                        oldBucketIndex: bucketLeftIndex
                    };
                } catch (e) {
                    console.warn(e);
                }
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
            this.games.set(gameAddressString, gameNow);
        }
        emitter.emit(event);
    }


    private async enrichGameObject(
        gameAddress: PublicKey,
        gameBefore: GameEnriched | undefined,
        gameNow: Game | null
    ): Promise<GameEnriched | null> {

        if (gameNow === null) {
            return null;
        }

        const gameConfigEnriched: GameConfigEnriched = {
            ...gameNow.config,
            mintDecimals: await this.getGameMintDecimals(gameBefore, gameNow)
        };

        return {
            ...gameNow,
            config: gameConfigEnriched,
            address: gameAddress
        };
    }


    private async getGameMintDecimals(gameBefore: GameEnriched | undefined, gameNow: Game | null): Promise<number> {
        Assert.notNullish(this.program, "program");
        let result: number;
        // avoid making a network call if we can get from the existing game state
        if ((gameBefore === undefined) || (gameBefore.config.mintDecimals === null)) {
            if (gameNow === null) {
                throw new Error("Game never existed.");
            }
            result = await this.getOrFetchMintDecimals(gameNow.config.mint);

        } else {
            result = gameBefore.config.mintDecimals;
        }
        return result;
    }


    /**
     * Gets the number of decimals for the given mint, pulling from
     * in-memory cache or fetching from on-chain if not in the cache.
     *
     * @param mint mint for which to retrieve decimals
     * @returns number of decimals for the mint
     */
    public async getOrFetchMintDecimals(mint: PublicKey): Promise<number> {
        Assert.notNullish(this.program, "program");
        const mintAddressString: string = mint.toBase58();
        const connection: Connection = this.program.provider.connection;
        return await this.mintDecimalsCache.getOrFetch(
            mintAddressString,
            () => getMintDecimals(mint, connection)
        );
    }


    private getBucketLeftIndex(bucketPlayerCountChanges: number[]): number {
        // dont include the holding bucket, which always contains "all" players
        const index: number = bucketPlayerCountChanges.slice(1).findIndex(c => c < 0);
        if (index === -1) {
            throw new Error("Unable to determine bucket left");
        }
        return index + 1;
    }


    private getBucketEnteredIndex(bucketPlayerCountChanges: number[]): number {
        // dont include the holding bucket, which always contains "all" players
        const index: number = bucketPlayerCountChanges.slice(1).findIndex(c => c > 0);
        if (index === -1) {
            throw new Error("Unable to determine bucket entered");
        }
        return index + 1;
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
        const subscription: Subscription<GameEvent> | undefined = this.gameSubscriptions.get(gameAddressString);
        if (subscription !== undefined) {
            subscription.emitter.unsubscribeAll();
            await this.program.provider.connection.removeAccountChangeListener(subscription.id);
            this.gameSubscriptions.delete(gameAddressString);
        }
    }


    /**
     * Subscribes to changes to the given player's state in the given game,
     * calling the callback whenever an update is received.
     *
     * @param playerAddress player to start watching
     * @param gameAddress game of player to start watching
     * @param callback callback to call with player state whenever an update is received
     * @throws if this is a dummy SDK instance
     */
    public watchPlayer(
        playerAddress: PublicKey,
        gameAddress: PublicKey,
        callback: PlayerStateEventCallback,
        fetchNow: boolean = false
    ): void {
        Assert.notNullish(this.program, "program");

        // subscribe to the game as well - will already be most likely - so that we can draw on its state
        // to determine additional context for the player
        this.addOrGetGameSubscription(gameAddress);

        const program = this.program;
        getPlayerStateAddress(gameAddress, playerAddress, program.programId)
            .then(async (playerStateAddresss) => {
                const subscription: Subscription<PlayerStateEvent>
                    = this.addOrGetPlayerStateSubscription(playerAddress, playerStateAddresss, gameAddress);

                subscription.emitter.subscribe(callback);

                if (fetchNow) {
                    const playerState: PlayerState | null = await this.getPlayerState(
                        gameAddress,
                        playerAddress
                    );

                    await this.processAndEmitPlayerStateEvent(
                        playerAddress,
                        playerStateAddresss,
                        gameAddress,
                        playerState,
                        subscription.emitter
                    );
                }
            });
    }


    private addOrGetPlayerStateSubscription(
        playerAddress: PublicKey,
        playerStateAddress: PublicKey,
        gameAddress: PublicKey
    ): Subscription<PlayerStateEvent> {

        Assert.notNullish(this.program, "program");
        const playerStateAddressString: string = playerStateAddress.toBase58();
        let subscription: Subscription<PlayerStateEvent> | undefined =
            this.playerStateSubscriptions.get(playerStateAddressString);

        if (subscription !== undefined) {
            return subscription;
        }

        const program: anchor.Program<Equilibrate> = this.program;
        const connection: Connection = this.program.provider.connection;
        const emitter: EventEmitter<PlayerStateEvent> = new EventEmitter();
        // we have to use connection.onAccountChange for accounts that may be deleted while we're watching them
        // because anchor doesnt handle that
        const listenerId: number = connection.onAccountChange(playerStateAddress, async (buffer) => {
            let playerState: PlayerState | null = null;
            if (buffer != null && buffer.data.length > 0) {
                // The string "playerState" here matches the name of the game state account in the rust program.
                playerState = program.coder.accounts.decode<PlayerState>("playerState", buffer.data);
            }
            await this.processAndEmitPlayerStateEvent(
                playerAddress,
                playerStateAddress,
                gameAddress,
                playerState,
                emitter
            );
        });
        subscription = { emitter: emitter, id: listenerId };
        this.playerStateSubscriptions.set(playerStateAddressString, subscription);
        return subscription;
    }


    private async processAndEmitPlayerStateEvent(
        playerAddress: PublicKey,
        playerStateAddress: PublicKey,
        gameAddress: PublicKey,
        playerState: PlayerState | null,
        emitter: EventEmitter<PlayerStateEvent>
    ): Promise<void> {
        const playerStateAddressString: string = playerStateAddress.toBase58();
        const playerStateBefore: PlayerState | undefined = this.playerStates.get(playerStateAddressString);
        const event: PlayerStateEvent = {
            player: playerState === null ? null : {
                ...playerState,
                gameAddress: gameAddress,
                stateAddress: playerStateAddress,
                playerAddress: playerAddress
            }
        };
        const mostRecentGame: GameEnriched | undefined = this.games.get(gameAddress.toBase58());
        if (playerState === null) {
            if (playerStateBefore !== undefined) {
                let approximateWinnings: number = 0;
                if (mostRecentGame !== undefined) {
                    if (mostRecentGame.state.buckets[0].players === 1) {
                        // player was the last one to leave and so took everything left
                        approximateWinnings = mostRecentGame.state.buckets.reduce((sum, bucket) =>
                            sum + bucket.decimalTokens.toNumber(), 0
                        );
                    } else {
                        // player wasnt last one left, so they only took a fraction of their bucket
                        const bucketLeft: Bucket = mostRecentGame.state.buckets[playerStateBefore.bucket];
                        approximateWinnings = bucketLeft.decimalTokens.toNumber() / bucketLeft.players;
                    }
                }
                event.leave = {
                    bucketIndex: playerStateBefore.bucket,
                    winningsDecimalTokens: approximateWinnings,
                };
            }
        } else if (playerStateBefore === undefined) {
            if (mostRecentGame === undefined) {
                // most likely the player created a new game, though this isnt guaranteed
                event.new = {
                    bucketIndex: playerState.bucket
                };
            } else {
                event.enter = {
                    bucketIndex: playerState.bucket
                };
            }
            this.playerStates.set(playerStateAddressString, playerState);

        } else {
            event.move = {
                newBucketIndex: playerState.bucket,
                oldBucketIndex: playerStateBefore.bucket
            };
            this.playerStates.set(playerStateAddressString, playerState);
        }
        emitter.emit(event);
    }


    /**
     * Stops watching the given player's game state, meaning all registered callbacks will cease to work.
     *
     * Does nothing if the player isnt being watched.
     *
     * @param playerAddress player to stop watching
     * @param gameAddress game of the player to stop watching
     * @throws if this is a dummy SDK instance
     */
    public async stopWatchingPlayerState(playerAddress: PublicKey, gameAddress: PublicKey): Promise<void> {
        Assert.notNullish(this.program, "program");
        const playerStateAddress: PublicKey = await getPlayerStateAddress(
            gameAddress,
            playerAddress,
            this.program.programId
        );
        const playerStateAddressString: string = playerStateAddress.toBase58();
        const subscription: Subscription<PlayerStateEvent> | undefined
            = this.playerStateSubscriptions.get(playerStateAddressString);

        if (subscription !== undefined) {
            subscription.emitter.unsubscribeAll();
            await this.program.provider.connection.removeAccountChangeListener(subscription.id);
            this.playerStateSubscriptions.delete(playerStateAddressString);
        }
    }
}


interface RequestStep {
    name: string;
    buildInstructions: () => Promise<TransactionInstruction[]>;
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
    private readonly sdk: EquilibrateSDK;
    private readonly connection: Connection;
    private readonly playerAddress: PublicKey;
    private readonly steps: RequestStep[] = [];
    private readonly config: {
        mint?: PublicKey;
        entryFee?: number;
        entryFeeDecimalTokens?: number;
        spillRateTokensPerSecondPerPlayer?: number;
        nBuckets?: number;
        maxPlayers?: number;
        burnRateTokensPerMove?: number;
    } = {};
    private bucketIndex: number | undefined;
    private gameId: number | undefined;
    private cancelOnLoss: boolean | undefined;
    private neededToCreatePlayerTokenAccount: boolean = false;

    private constructor(sdk: EquilibrateSDK, program: anchor.Program<Equilibrate>, playerAddress: PublicKey) {
        this.sdk = sdk;
        this.program = program;
        this.connection = program.provider.connection;
        this.playerAddress = playerAddress;
    }

    public static new(
        sdk: EquilibrateSDK,
        program: anchor.Program<Equilibrate>,
        overridePlayer?: PublicKey
    ): EquilibrateRequest {
        const playerAddress: PublicKey | undefined = overridePlayer ?? program.provider.publicKey;
        Assert.notNullish(playerAddress, "player");
        return new EquilibrateRequest(sdk, program, playerAddress);
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
    public setEntryFeeTokens(entryFee: number): EquilibrateRequest {
        Assert.greaterThan(entryFee, ENTRY_FEE_MIN_EXCLUSIVE, "entryFee");
        this.config.entryFee = entryFee;
        return this;
    }


    /**
     * Sets the entry fee for a new game.
     *
     * @param entryFee entry fee in decimal tokens
     * @returns this request
     * @throws if the entry fee is too small
     */
    public setEntryFeeDecimalTokens(entryFeeDecimalTokens: number): EquilibrateRequest {
        Assert.greaterThan(entryFeeDecimalTokens, ENTRY_FEE_MIN_EXCLUSIVE, "entryFeeDecimalTokens");
        Assert.isInteger(entryFeeDecimalTokens, "entryFeeDecimalTokens");
        this.config.entryFeeDecimalTokens = entryFeeDecimalTokens;
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
     * Sets the burn rate for a new game.
     *
     * @param burnRateTokensPerMove burn rate in normal units (not whole-number decimal units) of
     * tokens per player move
     * @returns this request
     * @throws if the burn rate is too low
     */
    public setBurnRate(burnRateTokensPerMove: number): EquilibrateRequest {
        Assert.greaterThanOrEqualTo(
            burnRateTokensPerMove,
            BURN_RATE_MIN,
            "burnRateTokensPerMove"
        );
        this.config.burnRateTokensPerMove = burnRateTokensPerMove;
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
     * @param finalizedCallback callback to call when the game config has been finalized
     * @returns this request
     * @throws if any of the following have not been set: `mint`, `entryFeeDecimalTokens`,
     * `spillRateDecimalTokensPerSecondPerPlayer`, `nBuckets`, `maxPlayers`
     */
    public withCreateNewGame(finalizedCallback?: (gameAddress: PublicKey) => void): EquilibrateRequest {
        this.validateConfig();

        this.withWrapSolInstructionsIfNeeded("create game: wrap SOL");

        this.addStep("create game", async () => {
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
                        payer: this.playerAddress,
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

            const gameId: number = this.gameId ?? this.generateGameId();
            const gameAddress: PublicKey = await getGameAddress(gameId, this.program.programId);
            if (finalizedCallback !== undefined) finalizedCallback(gameAddress);
            const playerStateAddress: PublicKey = await getPlayerStateAddress(
                gameAddress,
                this.playerAddress,
                this.program.programId
            );
            const playerTokenAccount: PublicKey = await getAssociatedTokenAddress(config.mint, this.playerAddress);
            const newGameInstruction: TransactionInstruction = await this.program
                .methods
                .newGame(
                    config,
                    new anchor.BN(gameId),
                    poolManagerAddress
                )
                .accountsStrict({
                    tokenPool: tokenPoolAddress,
                    payer: this.playerAddress,
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

            return instructions;
        });

        this.withCloseTokenAccountInstructionIfNeeded();

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
        Assert.notNullish(
            this.config.burnRateTokensPerMove,
            "burnRateTokensPerMove"
        );
    }


    private async finalizeConfig(): Promise<GameConfig> {
        Assert.notNullish(this.config.mint, "mint");
        Assert.notNullish(
            this.config.spillRateTokensPerSecondPerPlayer,
            "spillRateTokensPerSecondPerPlayer"
        );
        Assert.notNullish(this.config.nBuckets, "nBuckets");
        Assert.notNullish(this.config.maxPlayers, "maxPlayers");
        Assert.notNullish(
            this.config.burnRateTokensPerMove,
            "burnRateTokensPerMove"
        );
        const mintToDecimalMultiplier: number = await this.computeMintToDecimalMultiplier();
        const entryFeeWithDecimals: anchor.BN = await this.computeEntryFeeDecimalTokens(mintToDecimalMultiplier);
        const spillRateWithDecimals: anchor.BN = new anchor.BN(
            this.config.spillRateTokensPerSecondPerPlayer * mintToDecimalMultiplier
        );
        const burnRateDecimalTokensPerMove: anchor.BN = new anchor.BN(
            this.config.burnRateTokensPerMove * mintToDecimalMultiplier
        );

        return {
            mint: this.config.mint,
            entryFeeDecimalTokens: entryFeeWithDecimals,
            spillRateDecimalTokensPerSecondPerPlayer: spillRateWithDecimals,
            nBuckets: this.config.nBuckets,
            maxPlayers: this.config.maxPlayers,
            burnRateDecimalTokensPerMove: burnRateDecimalTokensPerMove
        };
    }


    private async computeMintToDecimalMultiplier(): Promise<number> {
        Assert.notNullish(this.config.mint, "mint");
        const mintDecimals: number = await this.sdk.getOrFetchMintDecimals(this.config.mint);
        return Math.pow(10, mintDecimals);
    }


    private async computeEntryFeeDecimalTokens(mintToDecimalMultiplier: number): Promise<anchor.BN> {
        if (this.config.entryFeeDecimalTokens !== undefined) return new anchor.BN(this.config.entryFeeDecimalTokens);

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
     * https://spl.solana.com/token#example-wrapping-sol-in-a-token
     *
     */
    private withWrapSolInstructionsIfNeeded(stepName: string): EquilibrateRequest {
        Assert.notNullish(this.config.mint, "mint");
        const mint: PublicKey = this.config.mint;

        if (mint.toBase58() === NATIVE_MINT.toBase58()) {
            Assert.someNotNullish(
                [this.config.entryFee, this.config.entryFeeDecimalTokens],
                ["entryFee", "entryFeeDecimalTokens"]
            );

            this.addStep(stepName, async () => {
                const playerTokenAccount: PublicKey = await getAssociatedTokenAddress(mint, this.playerAddress);
                const entryFeeWithDecimals: anchor.BN = await this.resolveEntryFeeDecimalTokens();
                const nativeTokenAccountExists: boolean = await accountExists(
                    playerTokenAccount,
                    this.program.provider.connection
                );

                const instructions: TransactionInstruction[] = [];
                if (!nativeTokenAccountExists) {
                    this.neededToCreatePlayerTokenAccount = true;
                    instructions.push(await this.makeCreateTokenAccountInstruction(
                        mint,
                        this.playerAddress,
                        playerTokenAccount
                    ));

                    const depositSolInstruction: TransactionInstruction = anchor.web3
                        .SystemProgram
                        .transfer({
                            fromPubkey: this.playerAddress,
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

                return instructions;
            });
        }
        return this;
    }


    /**
     * Adds instruction to enter an existing game as a new player.
     *
     * @returns this request
     * @throws if any of the following have not been set: `mint`, `bucketIndex`, `gameId`
     * @throws if the mint is SOL and `entryFeeDecimalTokens` has not been set
     */
    public withEnterGame(): EquilibrateRequest {
        Assert.notNullish(this.bucketIndex, "bucketIndex");
        Assert.notNullish(this.config.mint, "mint");
        Assert.notNullish(this.gameId, "gameId");
        const bucketIndex: number = this.bucketIndex;
        const mint: PublicKey = this.config.mint;
        const gameId: number = this.gameId;

        this.withWrapSolInstructionsIfNeeded("enter game: wrap SOL");

        this.addStep("enter game", async () => {
            const poolManagerAddress: PublicKey = (await getPoolManagerAddress(mint, this.program.programId))[0];
            const tokenPoolAddress: PublicKey = await getTokenPoolAddress(
                mint,
                this.program.programId
            );
            const gameAddress: PublicKey = await getGameAddress(gameId, this.program.programId);
            const playerStateAddress: PublicKey = await getPlayerStateAddress(
                gameAddress,
                this.playerAddress,
                this.program.programId
            );
            const playerTokenAccount: PublicKey = await getAssociatedTokenAddress(mint, this.playerAddress);
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
                    payer: this.playerAddress,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SYSTEM_PROGRAM_ID,
                    rent: RENT_SYSVAR,
                    player: playerStateAddress
                })
                .instruction();

            return [instruction];
        });

        this.withCloseTokenAccountInstructionIfNeeded();

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
        const bucketIndex: number = this.bucketIndex;
        const gameId: number = this.gameId;
        this.addStep("move bucket", async () => {
            const gameAddress: PublicKey = await getGameAddress(gameId, this.program.programId);
            const playerStateAddress: PublicKey = await getPlayerStateAddress(
                gameAddress,
                this.playerAddress,
                this.program.programId
            );
            const instruction: TransactionInstruction = await this.program
                .methods
                .moveBuckets(bucketIndex)
                .accountsStrict({
                    game: gameAddress,
                    payer: this.playerAddress,
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
        const mint: PublicKey = this.config.mint;
        const gameId: number = this.gameId;
        const cancelOnLoss: boolean = this.cancelOnLoss;
        this.addStep("leave game", async () => {
            const instructions: TransactionInstruction[] = [];

            const playerTokenAccount: PublicKey = await getAssociatedTokenAddress(mint, this.playerAddress);
            const shouldCreateAndCloseTokenAccount = !await accountExists(
                playerTokenAccount,
                this.program.provider.connection
            );

            if (shouldCreateAndCloseTokenAccount) {
                // really the only time we should get here is if playing with SOL, such that we
                // already created and closed the wrapped SOL account to create or enter the game
                instructions.push(await this.makeCreateTokenAccountInstruction(
                    mint,
                    this.playerAddress,
                    playerTokenAccount
                ));
                this.neededToCreatePlayerTokenAccount = true;
            }

            const poolManagerAddress: PublicKey = (await getPoolManagerAddress(mint, this.program.programId))[0];
            const tokenPoolAddress: PublicKey = await getTokenPoolAddress(
                mint,
                this.program.programId
            );
            const gameAddress: PublicKey = await getGameAddress(gameId, this.program.programId);
            const playerStateAddress: PublicKey = await getPlayerStateAddress(
                gameAddress,
                this.playerAddress,
                this.program.programId
            );
            const game: Game = await this.sdk.getGame(gameAddress);
            const leaveInstruction: TransactionInstruction = await this.program
                .methods
                .leaveGame(cancelOnLoss)
                .accountsStrict({
                    game: gameAddress,
                    payer: this.playerAddress,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SYSTEM_PROGRAM_ID,
                    player: playerStateAddress,
                    poolManager: poolManagerAddress,
                    tokenPool: tokenPoolAddress,
                    gameCreator: game.creator,
                    winningsDestinationAccount: playerTokenAccount,
                    gameMint: mint
                })
                .instruction();

            instructions.push(leaveInstruction);

            return instructions;
        });

        this.withCloseTokenAccountInstructionIfNeeded();

        return this;
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


    // https://spl.solana.com/token#example-wrapping-sol-in-a-token
    private withCloseTokenAccountInstructionIfNeeded(): EquilibrateRequest {
        Assert.notNullish(this.config.mint, "mint");

        const mint: PublicKey = this.config.mint;

        this.addStep("close token account", async () => {
            if (!this.neededToCreatePlayerTokenAccount) return [];
            const playerTokenAccount: PublicKey = await getAssociatedTokenAddress(mint, this.playerAddress);
            const instruction: TransactionInstruction = await anchor.Spl
                .token(this.program.provider)
                .methods
                .closeAccount()
                .accountsStrict({
                    authority: this.playerAddress,
                    account: playerTokenAccount,
                    destination: this.playerAddress
                })
                .instruction();

            return [instruction];
        });

        return this;
    }


    private async resolveEntryFeeDecimalTokens(): Promise<anchor.BN> {
        Assert.someNotNullish(
            [this.config.entryFee, this.config.entryFeeDecimalTokens],
            ["entryFee", "entryFeeDecimalTokens"]
        );
        let entryFeeWithDecimals: anchor.BN;
        if (this.config.entryFeeDecimalTokens != null) {
            entryFeeWithDecimals = new anchor.BN(this.config.entryFeeDecimalTokens);

        } else if (this.config.entryFee != null) {
            const mintToDecimalMultiplier: number = await this.computeMintToDecimalMultiplier();
            entryFeeWithDecimals = await this.computeEntryFeeDecimalTokens(mintToDecimalMultiplier);

        } else {
            // this will never be reached because we check for the values being available above,
            // just dont have a way to tell typescript it's good
            entryFeeWithDecimals = new anchor.BN(0);
        }
        return entryFeeWithDecimals;
    }


    /**
     * Add arbitrary instructions to be executed atomically with others in this request.
     *
     * @param instructions instructions to add to the transaction
     * @returns this request
     */
    public withInstructions(...instructions: TransactionInstruction[]): EquilibrateRequest {
        this.addStep("custom instructions", async () => instructions);
        return this;
    }


    private addStep(name: RequestStep["name"], builder: RequestStep["buildInstructions"]): void {
        this.steps.push({
            name: name,
            buildInstructions: builder
        });
    }


    /**
     * Signs and submits the request (collection of transaction instructions) to the chain
     *
     * @returns the transaction
     */
    public async signAndSend(simulateOnly?: boolean): Promise<RequestResult> {
        Assert.notNullish(this.program.provider.sendAndConfirm, "program.provider.sendAndConfirm");
        const transaction: Transaction = new Transaction();
        for (const step of this.steps) {
            try {
                const instructions: TransactionInstruction[] = await step.buildInstructions();
                if (instructions.length > 0) {
                    transaction.add(...instructions);
                }

            } catch (e) {
                throw new Error(`Error while building instructions for '${step.name}'`, {cause: e});
            }
        }

        let result: RequestResult;
        if (simulateOnly) {
            // unlike other parts of the instructions, try to use the provider as the
            // payer first and then fall back to the specified player (though the two
            // being different will probably fail the transaction anyway)
            const payer: PublicKey = this.program.provider.publicKey ?? this.playerAddress;
            Assert.notNullish(payer, "payer");
            transaction.feePayer = payer;
            const simulationResult = await this.program.provider.connection.simulateTransaction(transaction);
            result = { simulationResult: simulationResult.value };

        } else {
            try {
                const signature: string = await this.program.provider.sendAndConfirm(
                    transaction,
                    undefined,
                    { commitment: "confirmed" }
                );

                result = { transactionSignature: signature };

            } catch (e) {
                if (e instanceof AnchorError) {
                    if (e.error.errorCode.code === PROGRAM_ERROR_ABORT_LEAVE_ON_LOSS) {
                        result = { error: e, anchorErrorCode: e.error.errorCode.code };

                    } else {
                        throw e;
                    }
                } else if (e instanceof SendTransactionError) {
                    const isAbortLeaveOnLoss: boolean = e.logs?.some(e => e.includes(
                        PROGRAM_ERROR_ABORT_LEAVE_ON_LOSS
                    )) ?? false;
                    if (isAbortLeaveOnLoss) {
                        result = { error: e, anchorErrorCode: PROGRAM_ERROR_ABORT_LEAVE_ON_LOSS };

                    } else {
                        if (e.logs != null) {
                            console.error([e.message, "\nPROGRAM LOGS", ...e.logs].join("\n"));
                        }
                        throw e;
                    }
                } else {
                    throw e;
                }
            }
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

    public static someNotNullish<T>(values: T[], names: string[]): void {
        if (values.every(v => v == null)) {
            throw new Error("Must define at least one of " + names.join(", "));
        }
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

    public static isInteger(arg: number, name: string): void {
        if (!Number.isInteger(arg)) {
            throw new Error(`${name} must be an integer`);
        }
    }
}
