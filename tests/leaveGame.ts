import * as anchor from "@project-serum/anchor";
import { Equilibrate } from "../target/types/equilibrate";
import {
  generateGameId,
  getGame,
} from "./helpers/game";
import {
  generateMint,
  makeAndFundWallet,
  makeAssociatedTokenAccount,
  makeAssociatedTokenAccountWithPayer,
  MINT_DECIMALS,
} from "./helpers/token";
import { GameState } from "./helpers/types";
import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import {
  GAME_SEED,
  getAssociatedTokenAddress,
  getGameAddress,
  getPlayerStateAddress,
  PLAYER_SEED,
} from "./helpers/address";
import { assert } from "chai";
import { NewGameContext, NewGameSetupArgs, setUpNewGame } from "./newGame";
import { testIsReady } from "./setup";
import {
  EnterGameContext,
  EnterGameSetupArgs,
  setUpEnterGame,
  setUpEnterGameEtc,
  EnterGameEtcContext,
} from "./enterGame";
import { assertAsyncThrows } from "./helpers/test";
import { getAccount } from "@solana/spl-token";
import { CreatePoolContext, CreatePoolSetupArgs, setUpCreatePool } from "./createPool";

describe.only("LeaveGame Instruction Tests", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.Equilibrate as anchor.Program<Equilibrate>;

  it("leave game > game - bad seed - seed > fails", async () => {
    const gameId: number = generateGameId();
    const goodGameAddress: PublicKey = await getGameAddress(
      gameId,
      program.programId
    );
    const badGameAddress: PublicKey = (
      await PublicKey.findProgramAddress(
        [
          anchor.utils.bytes.utf8.encode("a bad seed my dude"),
          new anchor.BN(gameId).toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      )
    )[0];

    const enterEtcContext: EnterGameEtcContext =
      await setUpEnterGameEtc(program, {
        newGame: {
          gameId: gameId,
          gameAddress: goodGameAddress,
        },
      });

    await assertAsyncThrows(
      () =>
        setUpLeaveGame(
          program,
          enterEtcContext.createPool,
          enterEtcContext.newGame,
          enterEtcContext,
          {
            gameAddress: badGameAddress,
          },
          true
        ),
      // there's not really a situation where we can try to leave a game
      // that already exists but then provide a bad seeded game address, so
      // checking that the account isnt initialized is as close as we can get
      "AccountNotInitialized"
    );
  });

  it("leave game > game - bad seed - game ID > fails", async () => {
    const gameId: number = generateGameId();
    const goodGameAddress: PublicKey = await getGameAddress(
      gameId,
      program.programId
    );
    const badGameAddress: PublicKey = (
      await PublicKey.findProgramAddress(
        [
          anchor.utils.bytes.utf8.encode(GAME_SEED),
          new anchor.BN(generateGameId()).toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      )
    )[0];

    const enterEtcContext: EnterGameEtcContext =
      await setUpEnterGameEtc(program, {
        newGame: {
          gameId: gameId,
          gameAddress: goodGameAddress,
        },
      });

    await assertAsyncThrows(
      () =>
        setUpLeaveGame(
          program,
          enterEtcContext.createPool,
          enterEtcContext.newGame,
          enterEtcContext,
          {
            gameAddress: badGameAddress,
          }
        )
    );
  });

  it("leave game > game - wrong game creator > fails", async () => {
    await assertAsyncThrows(
      () =>
        setUpLeaveGameEtc(program, {
          gameCreator: Keypair.generate().publicKey,
        }),
      "GameCreatorMismatch"
    );
  });

  it("leave game > player - bad seed - seed > fails", async () => {
    const enterEtcContext: EnterGameEtcContext =
      await setUpEnterGameEtc(program);

    const badPlayerStateAddress: PublicKey = (
      await PublicKey.findProgramAddress(
        [
          anchor.utils.bytes.utf8.encode("this player sucks"),
          enterEtcContext.newGame.gameAddress.toBuffer(),
          enterEtcContext.playerWallet.publicKey.toBuffer(),
        ],
        program.programId
      )
    )[0];

    await assertAsyncThrows(() =>
      setUpLeaveGame(
        program,
        enterEtcContext.createPool,
        enterEtcContext.newGame,
        enterEtcContext,
        {
          playerWallet: enterEtcContext.playerWallet,
          playerStateAddress: badPlayerStateAddress,
        }
      )
    );
  });

  it("leave game > player - bad seed - game  > fails", async () => {
    const enterEtcContext: EnterGameEtcContext =
      await setUpEnterGameEtc(program);

    const badPlayerStateAddress: PublicKey = (
      await PublicKey.findProgramAddress(
        [
          anchor.utils.bytes.utf8.encode(PLAYER_SEED),
          Keypair.generate().publicKey.toBuffer(),
          enterEtcContext.playerWallet.publicKey.toBuffer(),
        ],
        program.programId
      )
    )[0];

    await assertAsyncThrows(() =>
      setUpLeaveGame(
        program,
        enterEtcContext.createPool,
        enterEtcContext.newGame,
        enterEtcContext,
        {
          playerWallet: enterEtcContext.playerWallet,
          playerStateAddress: badPlayerStateAddress,
        }
      )
    );
  });

  it("leave game > player - bad seed - payer > fails", async () => {
    const enterEtcContext: EnterGameEtcContext =
      await setUpEnterGameEtc(program);

    const badPlayerStateAddress: PublicKey = (
      await PublicKey.findProgramAddress(
        [
          anchor.utils.bytes.utf8.encode(PLAYER_SEED),
          enterEtcContext.newGame.gameAddress.toBuffer(),
          Keypair.generate().publicKey.toBuffer(),
        ],
        program.programId
      )
    )[0];

    await assertAsyncThrows(() =>
      setUpLeaveGame(
        program,
        enterEtcContext.createPool,
        enterEtcContext.newGame,
        enterEtcContext,
        {
          playerWallet: enterEtcContext.playerWallet,
          playerStateAddress: badPlayerStateAddress,
        }
      )
    );
  });

  it("leave game > player - owner isnt program > fails", async () => {
    const enterEtcContext: EnterGameEtcContext =
      await setUpEnterGameEtc(program);

    const badPlayerStateAddress: PublicKey = (
      await PublicKey.findProgramAddress(
        [
          anchor.utils.bytes.utf8.encode(PLAYER_SEED),
          enterEtcContext.newGame.gameAddress.toBuffer(),
          enterEtcContext.playerWallet.publicKey.toBuffer(),
        ],
        anchor.web3.SystemProgram.programId
      )
    )[0];

    await assertAsyncThrows(() =>
      setUpLeaveGame(
        program,
        enterEtcContext.createPool,
        enterEtcContext.newGame,
        enterEtcContext,
        {
          playerWallet: enterEtcContext.playerWallet,
          playerStateAddress: badPlayerStateAddress,
        }
      )
    );
  });

  it("leave game > winnings_destination_account - wrong mint > fails", async () => {
    const connection: Connection = program.provider.connection;
    const authority: Keypair = await makeAndFundWallet(10, connection);
    const wrongMint: Keypair = await generateMint(authority, connection);
    const wallet: Keypair = await makeAndFundWallet(1, connection);

    const wrongTokenAccount: PublicKey = await makeAssociatedTokenAccountWithPayer(
      wallet,
      program.programId,
      wrongMint.publicKey,
      connection
    );

    await assertAsyncThrows(
      () =>
        setUpLeaveGameEtc(program, {
          playerTokenAccount: wrongTokenAccount,
        }),
      "ConstraintTokenOwner"
    );
  });

  it("leave game > token_pool - wrong mint > fails", async () => {
    const connection: Connection = program.provider.connection;
    const authority: Keypair = await makeAndFundWallet(10, connection);
    const wrongMint: Keypair = await generateMint(authority, connection);

    const context: CreatePoolContext = await setUpCreatePool(program);
    const context2: CreatePoolContext = await setUpCreatePool(program, {
      mint: wrongMint,
      mintAuthority: authority,
    })

    const newGameContext: NewGameContext = await setUpNewGame(program, context);
    const enterGameContext: EnterGameContext = await setUpEnterGame(program, context, newGameContext);

    await assertAsyncThrows(
      () =>
        setUpLeaveGame(program, context, newGameContext, enterGameContext, {
          tokenPoolAddress: context2.tokenPoolAddress,
        }),
        "ConstraintTokenOwner"
    );
  });

  it("leave game > token_pool - owner isnt manager > fails", async () => {
    const enterEtcContext: EnterGameEtcContext = await setUpEnterGameEtc(program);
    const connection: Connection = program.provider.connection;
    const wallet: Keypair = await makeAndFundWallet(1, connection);

    const wrongTokenPool: PublicKey = await makeAssociatedTokenAccount(
      wallet,
      enterEtcContext.createPool.mint.publicKey,
      connection
    );


    await assertAsyncThrows(
      () =>
        setUpLeaveGame(program, enterEtcContext.createPool, enterEtcContext.newGame, enterEtcContext, {
          tokenPoolAddress: wrongTokenPool,
        }),
      "ConstraintTokenOwner"
    );
  });

  it.only("leave game > bucket balances update correctly", async () => {
    const entryFee: number = 1 * Math.pow(10, MINT_DECIMALS);
    const spillRate: number = 1 * Math.pow(10, MINT_DECIMALS);
    const { newGame: newGameContext } = await setUpLeaveGameEtc(program, {
      enterGame: {
        otherPlayers: 1,
        playerBucketIndex: 2,
      },
      newGame: {
        gameConfig: {
          nBuckets: new anchor.BN(2),
          entryFeeDecimalTokens: new anchor.BN(entryFee),
          spillRateDecimalTokensPerSecondPerPlayer: new anchor.BN(spillRate),
        },
      },
    }, true);

    const gameState: GameState = (
      await getGame(newGameContext.gameAddress, program)
    ).state;

    // After the first player enters, the holding bucket gets their fee.
    // After the second player enters, the holding bucket distributes the holding
    // fee equally to the other two buckets, and we add the new player's fee
    // to the holding bucket. When the second player leaves, they take their proportion
    // of the bucket they were in and leave the remaining balance to the other
    // players.
    assert.strictEqual(gameState.buckets[0].decimalTokens.toNumber(), entryFee);
    assert.strictEqual(
      gameState.buckets[1].decimalTokens.toNumber(),
      entryFee
    );
    assert.strictEqual(
      gameState.buckets[2].decimalTokens.toNumber(),
      0
    );
  });

  it("leave game > token pool balance remains consistent", async () => {});

  it("leave game > last player to leave > gets remaining tokens", async () => {});

  it("leave game > last player to leave > game is closed and rent returned to creator", async () => {});

  it("leave game > game creator is only one to play > gets remaining tokens", async () => {});

  it("leave game > game creator is only one to play > game is closed and rent returned to creator", async () => {});

  it("leave game > non-last player to leave > gets proportion of their bucket tokens", async () => {});

  it("leave game > player state account is closed and rent returned to payer", async () => {});
});

export interface LeaveGameEtcSetupArgs extends LeaveGameSetupArgs {
  createPool?: CreatePoolSetupArgs;
  newGame?: NewGameSetupArgs;
  enterGame?: EnterGameSetupArgs;
}

export interface LeaveGameSetupArgs {
  gameAddress?: PublicKey;
  gameCreator?: PublicKey;
  playerStateAddress?: PublicKey;
  playerWallet?: Keypair;
  playerTokenAccount?: PublicKey;
  tokenPoolAddress?: PublicKey;
}

export interface LeaveGameContext {}

export interface LeaveGameEtcContext extends LeaveGameContext {
  createPool: CreatePoolContext;
  newGame: NewGameContext;
  enterGame: EnterGameContext;
}

export async function setUpLeaveGameEtc(
  program: anchor.Program<Equilibrate>,
  customSetup?: LeaveGameEtcSetupArgs,
  debug: boolean = false
): Promise<LeaveGameEtcContext> {
  const createPoolContext: CreatePoolContext = await setUpCreatePool(
    program,
    customSetup?.createPool,
    debug
  )

  const newGameContext: NewGameContext = await setUpNewGame(
    program,
    createPoolContext,
    customSetup?.newGame,
    debug
  );

  const enterGameContext: EnterGameContext = await setUpEnterGame(
    program,
    createPoolContext,
    newGameContext,
    customSetup?.enterGame,
    debug
  );

  const leaveGameContext: LeaveGameContext = await setUpLeaveGame(
    program,
    createPoolContext,
    newGameContext,
    enterGameContext,
    customSetup,
    debug
  );

  return {
    ...leaveGameContext,
    createPool: createPoolContext,
    newGame: newGameContext,
    enterGame: enterGameContext,
  };
}

async function setUpLeaveGame(
  program: anchor.Program<Equilibrate>,
  createPoolContext: CreatePoolContext,
  newGameContext: NewGameContext,
  enterGameContext: EnterGameContext,
  customSetup?: LeaveGameSetupArgs,
  debug: boolean = false
): Promise<LeaveGameContext> {
  if (!testIsReady()) throw new Error("not ready");

  let playerStateAddress: PublicKey;
  if (customSetup?.playerStateAddress) {
    playerStateAddress = playerStateAddress;
  } else if (customSetup?.playerWallet) {
    playerStateAddress = await getPlayerStateAddress(newGameContext.gameAddress, customSetup!.playerWallet.publicKey, program.programId);
  } else {
    playerStateAddress = enterGameContext.playerStateAddress;
  }

  let playerTokenAccount: PublicKey;
  if (customSetup?.playerTokenAccount) {
    playerTokenAccount = customSetup.playerTokenAccount;
  } else if (customSetup?.playerWallet) {
    playerTokenAccount = await getAssociatedTokenAddress(createPoolContext.mint.publicKey, customSetup?.playerWallet.publicKey);
  } else {
    playerTokenAccount = enterGameContext.playerTokenAccount;
  }

  try {
    await program.methods
      .leaveGame(createPoolContext.poolManagerAddress)
      .accountsStrict({
        game: customSetup?.gameAddress ?? newGameContext.gameAddress,
        gameCreator:
          customSetup?.gameCreator ?? newGameContext.playerWallet.publicKey,
        player: playerStateAddress,
        winningsDestinationAccount: playerTokenAccount,
        poolManager: createPoolContext.poolManagerAddress,
        tokenPool: customSetup?.tokenPoolAddress ?? createPoolContext.tokenPoolAddress,
        payer: customSetup?.playerWallet?.publicKey ?? enterGameContext.playerWallet.publicKey,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([customSetup?.playerWallet ?? enterGameContext.playerWallet])
      .rpc();
  } catch (e) {
    if (debug) {
      console.log(JSON.stringify(e, undefined, 2));
    }
    throw e;
  }

  return {};
}
