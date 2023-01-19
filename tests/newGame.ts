import * as anchor from "@project-serum/anchor";
import { Equilibrate } from "../target/types/equilibrate";
import {
    generateGameConfig,
    generateGameId,
    getGame,
    getPlayerState,
    MAX_GAME_BUCKETS,
    PROGRAM_FEE_DESTINATION,
    PROGRAM_FEE_LAMPORTS,
} from "./helpers/game";
import {
    generateMint,
    getSolBalance,
    getTokenBalanceWithoutDecimals,
    getTokenPoolBalanceWithoutDecimals,
    makeAndFundWallet,
    makeAndFundWalletWithTokens,
    MINT_DECIMALS,
    withoutDecimals,
} from "./helpers/token";
import { Game, GameConfig, PlayerState } from "./helpers/types";
import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import {
    GAME_SEED,
    getGameAddress,
    getPlayerStateAddress,
    PLAYER_SEED,
} from "./helpers/address";
import { assert } from "chai";
import { assertAsyncThrows } from "./helpers/test";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { testIsReady } from "./setup";
import {
    CreatePoolContext,
    CreatePoolSetupArgs,
    setUpCreatePool,
} from "./createPool";

describe("NewGame Instruction Tests", () => {
    anchor.setProvider(anchor.AnchorProvider.env());
    // eslint-disable-next-line import/namespace
    const program = anchor.workspace.Equilibrate as anchor.Program<Equilibrate>;

    it("create a new game > all good > game config and initial state are as expected", async () => {
        const {
            playerWallet,
            gameConfig,
            gameAddress,
            gameId,
            playerStateAddress,
        } = await setUpNewGameEtc(program);

        const game: Game = await getGame(gameAddress, program);
        assert.strictEqual(
            game.config.entryFeeDecimalTokens.toNumber(),
            gameConfig.entryFeeDecimalTokens.toNumber()
        );
        assert.strictEqual(game.config.nBuckets, gameConfig.nBuckets);
        assert.strictEqual(
            game.config.spillRateDecimalTokensPerSecondPerPlayer.toNumber(),
            gameConfig.spillRateDecimalTokensPerSecondPerPlayer.toNumber()
        );
        assert.strictEqual(game.config.mint.toBase58(), gameConfig.mint.toBase58());
        assert.strictEqual(
            game.creator.toBase58(),
            playerWallet.publicKey.toBase58()
        );
        assert.strictEqual(game.id.toNumber(), gameId);
        assert.strictEqual(
            game.state.buckets.length,
            // account for the holding bucket (bucket 0)
            gameConfig.nBuckets + 1
        );
        assert.strictEqual(
            game.config.maxPlayers,
            gameConfig.maxPlayers
        );
        assert.strictEqual(game.state.buckets[0].players, 1);
        assert.strictEqual(
            game.state.buckets[0].decimalTokens.toNumber(),
            gameConfig.entryFeeDecimalTokens.toNumber()
        );

        const firstPlayerState: PlayerState = await getPlayerState(
            playerStateAddress,
            program
        );
        assert.strictEqual(firstPlayerState.bucket, 1);
    });

    it("create a new game > all good > program fee is transferred", async () => {
        const connection: Connection = program.provider.connection;
        // appears that wallet balances (all ledger transactions?) carry over
        // across tests, so we need to check the change in balance rather than the
        // whole balance, since other tests may put program fee in the wallet
        const programFeeDestinatonBalancePreGame: number = await getSolBalance(
            PROGRAM_FEE_DESTINATION,
            connection
        );

        await setUpNewGameEtc(program);

        const programFeeDestinationBalance: number = await getSolBalance(
            PROGRAM_FEE_DESTINATION,
            connection
        );
        const programFeeSol: number = PROGRAM_FEE_LAMPORTS / anchor.web3.LAMPORTS_PER_SOL;

        assert.approximately(
            programFeeDestinationBalance - programFeeDestinatonBalancePreGame,
            programFeeSol,
            0.01*programFeeSol
        );
        // It would be great to also check that the player's balance went
        // down by the program fee, but without knowing solana's transaction
        // fee we cant calculate what the new balance should be. That's OK,
        // though, since the only source of income to the fee destination is
        // the player's account
    });

    it("create a new game > all good > game tokens are transfered", async () => {
        const connection: Connection = program.provider.connection;
        const {
            playerWallet,
            createPool: { mint },
            gameConfig,
            playerStartingTokens,
        } = await setUpNewGameEtc(program);

        const playerTokenBalance: number = await getTokenBalanceWithoutDecimals(
            playerWallet.publicKey,
            mint.publicKey,
            connection
        );
        const tokenPoolBalance: number = await getTokenPoolBalanceWithoutDecimals(
            mint.publicKey,
            program.programId,
            connection
        );
        const entryFeeWithoutDecimals: number = withoutDecimals(
            gameConfig.entryFeeDecimalTokens.toNumber(),
            MINT_DECIMALS
        );
        assert.approximately(
            entryFeeWithoutDecimals,
            tokenPoolBalance,
            Math.pow(10, -MINT_DECIMALS)
        );
        assert.approximately(
            entryFeeWithoutDecimals,
            playerStartingTokens - playerTokenBalance,
            Math.pow(10, -MINT_DECIMALS)
        );
    });

    it("create a new game > game - bad seed - seed > fails", async () => {
        const gameId: number = generateGameId();
        const gameAddress: PublicKey = (
            await PublicKey.findProgramAddress(
                [
                    anchor.utils.bytes.utf8.encode("a bad seed my dude"),
                    new anchor.BN(gameId).toArrayLike(Buffer, "le", 8),
                ],
                program.programId
            )
        )[0];

        await assertAsyncThrows(() =>
            setUpNewGameEtc(program, { gameId: gameId, gameAddress: gameAddress })
        );
    });

    it("create a new game > game - bad seed - gameId > fails", async () => {
        const gameId: number = generateGameId();
        const gameId2: number = gameId + 1;
        const gameAddress: PublicKey = (
            await PublicKey.findProgramAddress(
                [
                    anchor.utils.bytes.utf8.encode(GAME_SEED),
                    new anchor.BN(gameId2).toArrayLike(Buffer, "le", 8),
                ],
                program.programId
            )
        )[0];

        await assertAsyncThrows(() =>
            setUpNewGameEtc(program, { gameId: gameId, gameAddress: gameAddress })
        );
    });

    it("create a new game > firstPlayer - bad seed - seed > fails", async () => {
        const playerWallet: Keypair = Keypair.generate();
        const gameId: number = generateGameId();
        const gameAddress: PublicKey = await getGameAddress(
            gameId,
            program.programId
        );
        const playerStateAddress: PublicKey = (
            await PublicKey.findProgramAddress(
                [
                    anchor.utils.bytes.utf8.encode("this player sucks"),
                    gameAddress.toBuffer(),
                    playerWallet.publicKey.toBuffer(),
                ],
                program.programId
            )
        )[0];

        await assertAsyncThrows(() =>
            setUpNewGameEtc(program, {
                gameId: gameId,
                gameAddress: gameAddress,
                playerWallet: playerWallet,
                playerStateAddress: playerStateAddress,
            })
        );
    });

    it("create a new game > firstPlayer - bad seed - game > fails", async () => {
        const playerWallet: Keypair = Keypair.generate();
        const gameId: number = generateGameId();
        const gameAddress: PublicKey = await getGameAddress(
            gameId,
            program.programId
        );
        const playerStateAddress: PublicKey = (
            await PublicKey.findProgramAddress(
                [
                    anchor.utils.bytes.utf8.encode(PLAYER_SEED),
                    Keypair.generate().publicKey.toBuffer(),
                    playerWallet.publicKey.toBuffer(),
                ],
                program.programId
            )
        )[0];

        await assertAsyncThrows(() =>
            setUpNewGameEtc(program, {
                gameId: gameId,
                gameAddress: gameAddress,
                playerWallet: playerWallet,
                playerStateAddress: playerStateAddress,
            })
        );
    });

    it("create a new game > firstPlayer - bad seed - player > fails", async () => {
        const playerWallet: Keypair = Keypair.generate();
        const gameId: number = generateGameId();
        const gameAddress: PublicKey = await getGameAddress(
            gameId,
            program.programId
        );
        const playerStateAddress: PublicKey = (
            await PublicKey.findProgramAddress(
                [
                    anchor.utils.bytes.utf8.encode(PLAYER_SEED),
                    gameAddress.toBuffer(),
                    Keypair.generate().publicKey.toBuffer(),
                ],
                program.programId
            )
        )[0];

        await assertAsyncThrows(() =>
            setUpNewGameEtc(program, {
                gameId: gameId,
                gameAddress: gameAddress,
                playerWallet: playerWallet,
                playerStateAddress: playerStateAddress,
            })
        );
    });

    it("create a new game > wrong program fee destination > fails", async () => {
        await assertAsyncThrows(() =>
            setUpNewGameEtc(program, {
                programFeeDestination: Keypair.generate().publicKey,
            })
        );
    });

    it("create a new game > wrong player token account mint > fails", async () => {
        const connection: Connection = program.provider.connection;
        const playerWallet: Keypair = await makeAndFundWallet(1, connection);
        const authority: Keypair = await makeAndFundWallet(5, connection);
        const badMint: Keypair = await generateMint(authority, connection);
        const playerTokenAccount: PublicKey = await getAssociatedTokenAddress(
            badMint.publicKey,
            playerWallet.publicKey
        );
        await assertAsyncThrows(() =>
            setUpNewGameEtc(program, {
                playerWallet: playerWallet,
                playerTokenAccount: playerTokenAccount,
                mintAuthority: authority,
            })
        );
    });

    it("create a new game > wrong token pool mint > fails", async () => {
        const connection: Connection = program.provider.connection;
        const authority: Keypair = await makeAndFundWallet(5, connection);
        const badMint: Keypair = await generateMint(authority, connection);
        const gameId: number = generateGameId();
        const gameAddress: PublicKey = await getGameAddress(
            gameId,
            program.programId
        );
        const tokenPoolAddress: PublicKey = await getAssociatedTokenAddress(
            badMint.publicKey,
            program.programId
        );
        await assertAsyncThrows(() =>
            setUpNewGameEtc(program, {
                mintAuthority: authority,
                tokenPoolAddress: tokenPoolAddress,
                gameId: gameId,
                gameAddress: gameAddress,
            })
        );
    });

    it("create a new game > token pool owner is not game program > fails", async () => {
        const connection: Connection = program.provider.connection;
        const authority: Keypair = await makeAndFundWallet(5, connection);
        const badMint: Keypair = await generateMint(authority, connection);
        const gameId: number = generateGameId();
        const gameAddress: PublicKey = await getGameAddress(
            gameId,
            program.programId
        );
        const tokenPoolAddress: PublicKey = await getAssociatedTokenAddress(
            badMint.publicKey,
            Keypair.generate().publicKey
        );
        await assertAsyncThrows(() =>
            setUpNewGameEtc(program, {
                mintAuthority: authority,
                tokenPoolAddress: tokenPoolAddress,
                gameId: gameId,
                gameAddress: gameAddress,
            })
        );
    });

    it("create a new game > entry fee is non-positive > fails", async () => {
        await assertAsyncThrows(() =>
            setUpNewGameEtc(program, {
                gameConfig: {
                    entryFeeDecimalTokens: new anchor.BN(0),
                },
            })
        );
        await assertAsyncThrows(() =>
            setUpNewGameEtc(program, {
                gameConfig: {
                    entryFeeDecimalTokens: new anchor.BN(-1),
                },
            })
        );
    });

    it("create a new game > too few game buckets > fails", async () => {
        await assertAsyncThrows(() =>
            setUpNewGameEtc(program, {
                gameConfig: {
                    nBuckets: 1,
                },
            })
        );
    });

    it("create a new game > too many game buckets > fails", async () => {
        await assertAsyncThrows(() =>
            setUpNewGameEtc(program, {
                gameConfig: {
                    nBuckets: Math.ceil(Math.random() * 1000 + MAX_GAME_BUCKETS),
                },
            })
        );
    });

    it("create a new game > max players too small > fails", async () => {
        await assertAsyncThrows(() =>
            setUpNewGameEtc(program, {
                gameConfig: {
                    nBuckets: 1,
                },
            })
        );
    });

    it("create a new game > spill rate is non-positive > fails", async () => {
        await assertAsyncThrows(
            () =>
                setUpNewGameEtc(program, {
                    gameConfig: {
                        spillRateDecimalTokensPerSecondPerPlayer: new anchor.BN(0),
                    },
                }),
            "InvalidSpillRate"
        );
    });

    it("create a new game > wrong pool manager address > fails", async () => {
        const createPoolContext1: CreatePoolContext = await setUpCreatePool(
            program
        );
        const createPoolContext2: CreatePoolContext = await setUpCreatePool(
            program
        );
        await assertAsyncThrows(
            () =>
                setUpNewGame(program, createPoolContext1, {
                    poolManager: createPoolContext2.poolManagerAddress,
                }),
            "ConstraintTokenOwner"
        );
    });

    it("create a new game > wrong token pool address > fails", async () => {
        const createPoolContext1: CreatePoolContext = await setUpCreatePool(
            program
        );
        const createPoolContext2: CreatePoolContext = await setUpCreatePool(
            program
        );
        await assertAsyncThrows(
            () =>
                setUpNewGame(program, createPoolContext1, {
                    tokenPoolAddress: createPoolContext2.tokenPoolAddress,
                }),
            "ConstraintTokenOwner"
        );
    });
});

export interface NewGameEtcSetupArgs extends NewGameSetupArgs {
  createPool?: CreatePoolSetupArgs;
}

export interface NewGameSetupArgs {
  mintAuthority?: Keypair;
  mint?: Keypair;
  gameConfig?: {
    entryFeeDecimalTokens?: anchor.BN;
    spillRateDecimalTokensPerSecondPerPlayer?: anchor.BN;
    nBuckets?: number;
    maxPlayers?: number;
    burnRateDecimalTokensPerMove?: anchor.BN;
  };
  gameId?: number;
  gameAddress?: PublicKey;
  playerStartingSol?: number;
  playerStartingTokens?: number;
  playerWallet?: Keypair;
  playerTokenAccount?: PublicKey;
  playerStateAddress?: PublicKey;
  tokenPoolAddress?: PublicKey;
  programFeeDestination?: PublicKey;
  poolManager?: PublicKey;
}

export interface NewGameEtcContext extends NewGameContext {
  createPool: CreatePoolContext;
}

export interface NewGameContext {
  gameConfig: GameConfig;
  gameId: number;
  gameAddress: PublicKey;
  playerStartingSol: number;
  playerStartingTokens: number;
  playerWallet: Keypair;
  playerTokenAccount: PublicKey;
  playerStateAddress: PublicKey;
}

export async function setUpNewGameEtc(
    program: anchor.Program<Equilibrate>,
    customSetup?: NewGameEtcSetupArgs,
    debug: boolean = false
): Promise<NewGameEtcContext> {
    const createPoolContext: CreatePoolContext = await setUpCreatePool(
        program,
        customSetup?.createPool,
        debug
    );

    const newGameContext: NewGameContext = await setUpNewGame(
        program,
        createPoolContext,
        customSetup,
        debug
    );

    return {
        ...newGameContext,
        createPool: createPoolContext,
    };
}

export async function setUpNewGame(
    program: anchor.Program<Equilibrate>,
    createPoolContext: CreatePoolContext,
    customSetup?: NewGameSetupArgs,
    debug: boolean = false
): Promise<NewGameContext> {
    if (!testIsReady()) throw new Error("not ready");
    const connection: Connection = program.provider.connection;

    const config: GameConfig = generateGameConfig(
        createPoolContext.mint.publicKey
    );
    if (customSetup?.gameConfig?.entryFeeDecimalTokens != null) {
        config.entryFeeDecimalTokens =
      customSetup?.gameConfig?.entryFeeDecimalTokens;
    }

    if (customSetup?.gameConfig?.nBuckets != null) {
        config.nBuckets = customSetup?.gameConfig?.nBuckets;
    }

    if (customSetup?.gameConfig?.maxPlayers != null) {
        config.maxPlayers = customSetup?.gameConfig?.maxPlayers;
    }

    if ( customSetup?.gameConfig?.spillRateDecimalTokensPerSecondPerPlayer != null ) {
        config.spillRateDecimalTokensPerSecondPerPlayer =
            customSetup?.gameConfig?.spillRateDecimalTokensPerSecondPerPlayer;
    }

    if (customSetup?.gameConfig?.burnRateDecimalTokensPerMove != null) {
        config.burnRateDecimalTokensPerMove = customSetup?.gameConfig?.burnRateDecimalTokensPerMove;
    }

    const gameId: number = customSetup?.gameId ?? generateGameId();
    const gameAddress: PublicKey =
    customSetup?.gameAddress ??
    (await getGameAddress(gameId, program.programId));

    const playerTokens: number =
    customSetup?.playerStartingTokens != null
        ? customSetup?.playerStartingTokens
        : Math.ceil(
            1.1 *
            withoutDecimals(
                config.entryFeeDecimalTokens.toNumber(),
                MINT_DECIMALS
            )
        );

    const playerStartingSol: number =
    customSetup?.playerStartingSol != null
        ? customSetup?.playerStartingSol
        : (10 * PROGRAM_FEE_LAMPORTS) / anchor.web3.LAMPORTS_PER_SOL;

    let { wallet: player, tokenAccount: playerTokenAccount } =
    await makeAndFundWalletWithTokens(
        playerStartingSol,
        playerTokens,
        createPoolContext.mint.publicKey,
        createPoolContext.mintAuthority,
        connection
    );

    if (customSetup?.playerWallet != null) player = customSetup.playerWallet;

    if (customSetup?.playerTokenAccount != null) {
        playerTokenAccount = customSetup.playerTokenAccount;
    }

    const playerStateAddress: PublicKey =
    customSetup?.playerStateAddress ??
    (await getPlayerStateAddress(
        gameAddress,
        player.publicKey,
        program.programId
    ));

    try {
        await program.methods
            .newGame(
                config,
                new anchor.BN(gameId),
                customSetup?.poolManager ?? createPoolContext.poolManagerAddress
            )
            .accountsStrict({
                game: gameAddress,
                firstPlayer: playerStateAddress,
                programFeeDestination: customSetup?.programFeeDestination ?? PROGRAM_FEE_DESTINATION,
                depositSourceAccount: playerTokenAccount,
                tokenPool: customSetup?.tokenPoolAddress ?? createPoolContext.tokenPoolAddress,
                payer: player.publicKey,
                associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
                tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
                systemProgram: anchor.web3.SystemProgram.programId,
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            })
            .signers([player])
            .rpc();
    } catch (e) {
        if (debug) {
            console.trace(e);
        }
        throw e;
    }

    return {
        gameConfig: config,
        gameId,
        gameAddress,
        playerStartingSol,
        playerStartingTokens: playerTokens,
        playerWallet: player,
        playerTokenAccount,
        playerStateAddress,
    };
}
