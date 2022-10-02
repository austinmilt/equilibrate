import * as anchor from "@project-serum/anchor";
import { Equilibrate } from "../target/types/equilibrate";
import { generateGameId, getGame, getPlayerState } from "./helpers/game";
import {
  MINT_DECIMALS,
} from "./helpers/token";
import { GameState, PlayerState } from "./helpers/types";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  GAME_SEED,
  getGameAddress,
  getPlayerStateAddress,
  PLAYER_SEED,
} from "./helpers/address";
import { assert } from "chai";
import {
  NewGameContext,
  NewGameEtcContext,
  NewGameSetupArgs,
  setUpNewGame,
  setUpNewGameEtc,
} from "./newGame";
import { testIsReady } from "./setup";
import {
  EnterGameContext,
  EnterGameSetupArgs,
  setUpEnterGame,
  setUpEnterGameEtc,
  EnterGameEtcContext,
} from "./enterGame";
import { assertAsyncThrows } from "./helpers/test";
import {
  CreatePoolContext,
  CreatePoolSetupArgs,
  setUpCreatePool,
} from "./createPool";

describe("MoveBuckets Instruction Tests", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.Equilibrate as anchor.Program<Equilibrate>;

  it("move buckets > game - bad seed - seed > fails", async () => {
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

    const enterEtcContext: EnterGameEtcContext = await setUpEnterGameEtc(
      program,
      {
        newGame: {
          gameId: gameId,
          gameAddress: goodGameAddress,
        },
      }
    );

    await assertAsyncThrows(() =>
      setUpMoveBuckets(
        program,
        enterEtcContext.createPool,
        enterEtcContext.newGame,
        enterEtcContext,
        {
          gameAddress: badGameAddress,
        }
      ),
      "AccountNotInitialized"
    );
  });

  it("move buckets > game - bad seed - game ID > fails", async () => {
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

    const enterEtcContext: EnterGameEtcContext = await setUpEnterGameEtc(
      program,
      {
        newGame: {
          gameId: gameId,
          gameAddress: goodGameAddress,
        },
      }
    );

    await assertAsyncThrows(() =>
      setUpMoveBuckets(
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

  it("move buckets > player - bad seed - seed > fails", async () => {
    const enterEtcContext: EnterGameEtcContext = await setUpEnterGameEtc(
      program
    );

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
      setUpMoveBuckets(
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

  it("move buckets > player - bad seed - game  > fails", async () => {
    const enterEtcContext: EnterGameEtcContext = await setUpEnterGameEtc(
      program
    );

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
      setUpMoveBuckets(
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

  it("move buckets > player - bad seed - payer > fails", async () => {
    const enterEtcContext: EnterGameEtcContext = await setUpEnterGameEtc(
      program
    );

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
      setUpMoveBuckets(
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

  it("move buckets > player - owner isnt program > fails", async () => {
    const enterEtcContext: EnterGameEtcContext = await setUpEnterGameEtc(
      program
    );

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
      setUpMoveBuckets(
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

  it("move buckets > player tries to move to the same bucket > fails", async () => {
    const enterEtcContext: EnterGameEtcContext = await setUpEnterGameEtc(
      program);

    await assertAsyncThrows(() =>
      setUpMoveBuckets(
        program,
        enterEtcContext.createPool,
        enterEtcContext.newGame,
        enterEtcContext,
        {
          newBucketIndex: enterEtcContext.playerBucketIndex
        }
      ),
      "AlreadyInBucket"
    );
  });

  it("move buckets > player tries to move to a bucket that doesnt exist > fails", async () => {
    const enterEtcContext: EnterGameEtcContext = await setUpEnterGameEtc(program);

    await assertAsyncThrows(() =>
      setUpMoveBuckets(
        program,
        enterEtcContext.createPool,
        enterEtcContext.newGame,
        enterEtcContext,
        {
          newBucketIndex: enterEtcContext.newGame.gameConfig.nBuckets.toNumber() + 1
        }
      ),
      "BucketDoesNotExist"
    );
  });

  it("move buckets > player tries to move to holding bucket > fails", async () => {
    const enterEtcContext: EnterGameEtcContext = await setUpEnterGameEtc(
      program);

    await assertAsyncThrows(() =>
      setUpMoveBuckets(
        program,
        enterEtcContext.createPool,
        enterEtcContext.newGame,
        enterEtcContext,
        {
          newBucketIndex: 0
        }
      ),
      "CannotEnterHoldingBucket"
    );
  });

  it("move buckets > all good > player is moved to desired bucket", async () => {
    const nBuckets: number = Math.round(Math.random()*10) + 2;
    const enterEtcContext: EnterGameEtcContext = await setUpEnterGameEtc(
      program, {
        newGame: {
          gameConfig: {
            nBuckets: new anchor.BN(nBuckets)
          }
        }
      }
    );

    const bucketIndexBeforeMove: number = enterEtcContext.playerBucketIndex;
    let newBucketIndex: number = Math.ceil(Math.random()*nBuckets);
    while (bucketIndexBeforeMove === newBucketIndex) {
      newBucketIndex = Math.ceil(Math.random()*nBuckets);
    }

    const gameStateBeforeMove: GameState = (
      await getGame(enterEtcContext.newGame.gameAddress, program)
    ).state;

    await setUpMoveBuckets(
      program,
      enterEtcContext.createPool,
      enterEtcContext.newGame,
      enterEtcContext,
      {
        newBucketIndex: newBucketIndex
      }
    )

    const gameStateAfterMove: GameState = (
      await getGame(enterEtcContext.newGame.gameAddress, program)
    ).state;

    const playerState: PlayerState = await getPlayerState(enterEtcContext.playerStateAddress, program);

    assert.strictEqual(gameStateAfterMove.buckets[bucketIndexBeforeMove].players, gameStateBeforeMove.buckets[bucketIndexBeforeMove].players - 1);
    assert.strictEqual(gameStateAfterMove.buckets[newBucketIndex].players, gameStateBeforeMove.buckets[newBucketIndex].players + 1);
    assert.strictEqual(playerState.bucket.toNumber(), newBucketIndex);
  });

  it("move buckets > bucket balances update correctly", async () => {
    const entryFee: number = 1 * Math.pow(10, MINT_DECIMALS);
    const spillRate: number = Number.MAX_SAFE_INTEGER;
    const newGameContext: NewGameEtcContext = await setUpNewGameEtc(program, {
      gameConfig: {
        nBuckets: new anchor.BN(2),
        entryFeeDecimalTokens: new anchor.BN(entryFee),
        spillRateDecimalTokensPerSecondPerPlayer: new anchor.BN(spillRate),
      },
    });
    const enterGameContext: EnterGameContext = await setUpEnterGame(
      program,
      newGameContext.createPool,
      newGameContext,
      {
        playerBucketIndex: 2,
      }
    );
    await new Promise((r) => setTimeout(r, 1000));
    await setUpMoveBuckets(
      program,
      newGameContext.createPool,
      newGameContext,
      enterGameContext
    );

    const gameState: GameState = (
      await getGame(newGameContext.gameAddress, program)
    ).state;

    assert.strictEqual(gameState.buckets[0].decimalTokens.toNumber(), 0);
    assert.strictEqual(gameState.buckets[1].decimalTokens.toNumber(), entryFee);
    assert.strictEqual(gameState.buckets[2].decimalTokens.toNumber(), entryFee);
  });
});

export interface MoveBucketsEtcSetupArgs extends MoveBucketsSetupArgs {
  createPool?: CreatePoolSetupArgs;
  newGame?: NewGameSetupArgs;
  enterGame?: EnterGameSetupArgs;
}

export interface MoveBucketsSetupArgs {
  gameAddress?: PublicKey;
  playerStateAddress?: PublicKey;
  playerWallet?: Keypair;
  newBucketIndex?: number;
}

export interface MoveBucketsContext {
  newBucketIndex: number;
}

export interface MoveBucketsEtcContext extends MoveBucketsContext {
  createPool: CreatePoolContext;
  newGame: NewGameContext;
  enterGame: EnterGameContext;
}

export async function setUpLeaveGameEtc(
  program: anchor.Program<Equilibrate>,
  customSetup?: MoveBucketsEtcSetupArgs,
  debug: boolean = false
): Promise<MoveBucketsEtcContext> {
  const createPoolContext: CreatePoolContext = await setUpCreatePool(
    program,
    customSetup?.createPool,
    debug
  );

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

  const leaveGameContext: MoveBucketsContext = await setUpMoveBuckets(
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

async function setUpMoveBuckets(
  program: anchor.Program<Equilibrate>,
  createPoolContext: CreatePoolContext,
  newGameContext: NewGameContext,
  enterGameContext: EnterGameContext,
  customSetup?: MoveBucketsSetupArgs,
  debug: boolean = false
): Promise<MoveBucketsContext> {
  if (!testIsReady()) throw new Error("not ready");

  let playerStateAddress: PublicKey;
  if (customSetup?.playerStateAddress) {
    playerStateAddress = playerStateAddress;
  } else if (customSetup?.playerWallet) {
    playerStateAddress = await getPlayerStateAddress(
      newGameContext.gameAddress,
      customSetup!.playerWallet.publicKey,
      program.programId
    );
  } else {
    playerStateAddress = enterGameContext.playerStateAddress;
  }

  const newBucketIndex: number =
    customSetup?.newBucketIndex ??
    Math.floor(
      Math.random() * (newGameContext.gameConfig.nBuckets.toNumber() - 1) + 1
    );

  try {
    await program.methods
      .moveBuckets(new anchor.BN(newBucketIndex))
      .accountsStrict({
        game: customSetup?.gameAddress ?? newGameContext.gameAddress,
        player: playerStateAddress,
        payer:
          customSetup?.playerWallet?.publicKey ??
          enterGameContext.playerWallet.publicKey,
      })
      .signers([customSetup?.playerWallet ?? enterGameContext.playerWallet])
      .rpc();
  } catch (e) {
    if (debug) {
      console.log(JSON.stringify(e, undefined, 2));
    }
    throw e;
  }

  return {newBucketIndex: newBucketIndex};
}
