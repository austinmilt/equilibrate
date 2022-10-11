import * as anchor from "@project-serum/anchor";
import { Connection, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { Equilibrate } from "../../../../target/types/equilibrate";
import {
    ASSOCIATED_TOKEN_PROGRAM_ID,
    PROGRAM_FEE_DESTINATION,
    RENT_SYSVAR,
    SYSTEM_PROGRAM_ID,
    TOKEN_PROGRAM_ID
} from "./constants";
import { Game, GameConfig } from "./types";
import {
    getAssociatedTokenAddress,
    getGame,
    getGameAddress,
    getPlayerStateAddress,
    getPoolManagerAddress,
    getTokenPoolAddress
} from "./utils";

export interface SignerFunction {
  (transaction: Transaction): Promise<Transaction>;
}

export class EquilibrateSdk {
    // we allow these to be undefined so that on startup we
    // dont have to deal with null checks
    private readonly program: anchor.Program<Equilibrate> | undefined;
    private readonly payer: PublicKey | undefined;
    private readonly sign: SignerFunction | undefined;

    private constructor(
        program: anchor.Program<Equilibrate> | undefined,
        payer: PublicKey | undefined,
        sign: SignerFunction | undefined
    ) {
        this.program = program;
        this.payer = payer;
        this.sign = sign;
    }

    public static dummy(): EquilibrateSdk {
        return new EquilibrateSdk(undefined, undefined, undefined);
    }

    public static from(
        program: anchor.Program<Equilibrate>,
        payer: PublicKey,
        sign: SignerFunction
    ): EquilibrateSdk {
        return new EquilibrateSdk(program, payer, sign);
    }

    public isReady(): boolean {
        return this.program != null && this.payer != null && this.sign != null;
    }

    public request(): EquilibrateRequest {
        Assert.notNullish(this.program, "program");
        Assert.notNullish(this.payer, "payer");
        Assert.notNullish(this.sign, "sign");
        return EquilibrateRequest.new(this.program, this.payer, this.sign);
    }
}

export class EquilibrateRequest {
    private readonly program: anchor.Program<Equilibrate>;
    private readonly connection: Connection;
    private readonly steps: (() => Promise<TransactionInstruction[]>)[] = [];
    private readonly payer: PublicKey;
    private readonly sign: SignerFunction;
    private readonly config: {
        mint?: PublicKey;
        entryFeeDecimalTokens?: anchor.BN;
        spillRateDecimalTokensPerSecondPerPlayer?: anchor.BN;
        nBuckets?: number;
        maxPlayers?: number;
    } = {};
    private bucketIndex: number | undefined;
    private gameId: number | undefined;
    private cancelOnLoss: boolean | undefined;

    private constructor(
        program: anchor.Program<Equilibrate>,
        payer: PublicKey,
        sign: SignerFunction
    ) {
        this.program = program;
        this.connection = program.provider.connection;
        this.payer = payer;
        this.sign = sign;
    }

    public static new(
        program: anchor.Program<Equilibrate>,
        payer: PublicKey,
        sign: SignerFunction
    ): EquilibrateRequest {
        return new EquilibrateRequest(program, payer, sign);
    }

    public setMint(mint: PublicKey): EquilibrateRequest {
        this.config.mint = mint;
        return this;
    }

    public setEntryFee(entryFeeDecimalTokens: anchor.BN): EquilibrateRequest {
        this.config.entryFeeDecimalTokens = entryFeeDecimalTokens;
        return this;
    }

    public setSpillRate(spillRateDecimalTokensPerSecondPerPlayer: anchor.BN): EquilibrateRequest {
        this.config.spillRateDecimalTokensPerSecondPerPlayer = spillRateDecimalTokensPerSecondPerPlayer;
        return this;
    }

    public setNumberOfBuckets(nBuckets: number): EquilibrateRequest {
        this.config.nBuckets = nBuckets;
        return this;
    }

    public setMaxPlayers(maxPlayers: number): EquilibrateRequest {
        this.config.maxPlayers = maxPlayers;
        return this;
    }

    public setPlayerBucketIndex(bucketIndex: number): EquilibrateRequest {
        this.bucketIndex = bucketIndex;
        return this;
    }

    public setGameId(gameId: number): EquilibrateRequest {
        this.gameId = gameId;
        return this;
    }

    public setCancelOnLoss(cancelOnLoss: boolean): EquilibrateRequest {
        this.cancelOnLoss = cancelOnLoss;
        return this;
    }

    public withCreateNewGame(): EquilibrateRequest {
        const config: GameConfig = this.finalizeConfig();
        this.steps.push(async () => {
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
                        payer: this.payer,
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
            const playerStateAddress: PublicKey = await getPlayerStateAddress(
                gameAddress,
                this.payer,
                this.program.programId
            );
            const playerTokenAccount: PublicKey = await getAssociatedTokenAddress(config.mint, this.payer);
            const newGameInstruction: TransactionInstruction = await this.program
                .methods
                .newGame(
                    config,
                    new anchor.BN(gameId),
                    poolManagerAddress
                )
                .accountsStrict({
                    tokenPool: tokenPoolAddress,
                    payer: this.payer,
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

        return this;
    }

    public withEnterGame(): EquilibrateRequest {
        Assert.notNullish(this.bucketIndex, "bucketIndex");
        Assert.notNullish(this.config.mint, "mint");
        Assert.notNullish(this.gameId, "gameId");
        const bucketIndex: number = this.bucketIndex;
        const mint: PublicKey = this.config.mint;
        const gameId: number = this.gameId;
        this.steps.push(async () => {
            const poolManagerAddress: PublicKey = (await getPoolManagerAddress(mint, this.program.programId))[0];
            const tokenPoolAddress: PublicKey = await getTokenPoolAddress(
                mint,
                this.program.programId
            );
            const gameAddress: PublicKey = await getGameAddress(gameId, this.program.programId);
            const playerStateAddress: PublicKey = await getPlayerStateAddress(
                gameAddress,
                this.payer,
                this.program.programId
            );
            const playerTokenAccount: PublicKey = await getAssociatedTokenAddress(mint, this.payer);
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
                    payer: this.payer,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SYSTEM_PROGRAM_ID,
                    rent: RENT_SYSVAR,
                    player: playerStateAddress
                })
                .instruction();

            return [instruction];
        });

        return this;
    }

    public withMoveBucket(): EquilibrateRequest {
        Assert.notNullish(this.bucketIndex, "bucketIndex");
        Assert.notNullish(this.gameId, "gameId");
        const bucketIndex: number = this.bucketIndex;
        const gameId: number = this.gameId;
        this.steps.push(async () => {
            const gameAddress: PublicKey = await getGameAddress(gameId, this.program.programId);
            const playerStateAddress: PublicKey = await getPlayerStateAddress(
                gameAddress,
                this.payer,
                this.program.programId
            );
            const instruction: TransactionInstruction = await this.program
                .methods
                .moveBuckets(bucketIndex)
                .accountsStrict({
                    game: gameAddress,
                    payer: this.payer,
                    player: playerStateAddress
                })
                .instruction();

            return [instruction];
        });

        return this;
    }

    public withLeaveGame(): EquilibrateRequest {
        Assert.notNullish(this.config.mint, "mint");
        Assert.notNullish(this.gameId, "gameId");
        Assert.notNullish(this.cancelOnLoss, "cancelOnLoss");
        const mint: PublicKey = this.config.mint;
        const gameId: number = this.gameId;
        const cancelOnLoss: boolean = this.cancelOnLoss;
        this.steps.push(async () => {
            const poolManagerAddress: PublicKey = (await getPoolManagerAddress(mint, this.program.programId))[0];
            const tokenPoolAddress: PublicKey = await getTokenPoolAddress(
                mint,
                this.program.programId
            );
            const gameAddress: PublicKey = await getGameAddress(gameId, this.program.programId);
            const playerStateAddress: PublicKey = await getPlayerStateAddress(
                gameAddress,
                this.payer,
                this.program.programId
            );
            const playerTokenAccount: PublicKey = await getAssociatedTokenAddress(mint, this.payer);
            const game: Game = await getGame(gameAddress, this.program);
            const instruction: TransactionInstruction = await this.program
                .methods
                .leaveGame(cancelOnLoss)
                .accountsStrict({
                    game: gameAddress,
                    payer: this.payer,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SYSTEM_PROGRAM_ID,
                    player: playerStateAddress,
                    poolManager: poolManagerAddress,
                    tokenPool: tokenPoolAddress,
                    gameCreator: game.creator,
                    winningsDestinationAccount: playerTokenAccount
                })
                .instruction();

            return [instruction];
        });

        return this;
    }

    public withInstructions(...instructions: TransactionInstruction[]): EquilibrateRequest {
        this.steps.push(async () => instructions);
        return this;
    }

    public async signAndSend(): Promise<string> {
        Assert.notNullish(this.payer, "payer");
        const transaction: Transaction = new Transaction();
        for (const step of this.steps) {
            transaction.add(...(await step()));
        }
        const connection: Connection = this.program.provider.connection;
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.lastValidBlockHeight = lastValidBlockHeight;
        transaction.feePayer = this.payer;

        const signed: Transaction = await this.sign(transaction);
        return await connection.sendRawTransaction(signed.serialize());
    }

    private generateGameId(): number {
        // All we need is to ensure that each game is unique,
        // and using the epoch time in milliseconds will with very high
        // likelihood produce this result, while also conveniently
        // making games sequentially ordered
        return new Date().getTime();
    }

    private finalizeConfig(): GameConfig {
        Assert.notNullish(this.config.mint, "mint");
        Assert.notNullish(this.config.entryFeeDecimalTokens, "entryFeeDecimalTokens");
        Assert.notNullish(
            this.config.spillRateDecimalTokensPerSecondPerPlayer,
            "spillRateDecimalTokensPerSecondPerPlayer"
        );
        Assert.notNullish(this.config.nBuckets, "nBuckets");
        Assert.notNullish(this.config.maxPlayers, "maxPlayers");
        return {
            mint: this.config.mint,
            entryFeeDecimalTokens: this.config.entryFeeDecimalTokens,
            spillRateDecimalTokensPerSecondPerPlayer: this.config.spillRateDecimalTokensPerSecondPerPlayer,
            nBuckets: this.config.nBuckets,
            maxPlayers: this.config.maxPlayers
        };
    }
}

class Assert {
    private constructor() {
        // dont instantiate static class
    }

    public static notNullish<T>(arg: T, name: string): asserts arg is NonNullable<T> & void {
        if (arg == null) throw new Error("Must define " + name);
    }
}
