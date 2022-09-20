import * as anchor from "@project-serum/anchor";
import { Equilibrate } from "../target/types/equilibrate";
import {
  generateBucketIndex as chooseBucket,
  generateGameId,
  getGame,
  getPlayerState,
  PROGRAM_FEE_DESTINATION,
  PROGRAM_FEE_LAMPORTS,
} from "./helpers/game";
import {
  generateMint,
  makeAndFundWallet,
  makeAndFundWalletWithTokens,
  makeAssociatedTokenAccountWithPayer,
  MINT_DECIMALS,
  withoutDecimals,
} from "./helpers/token";
import { Game, PlayerState } from "./helpers/types";
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
  setUpNewGameAndEnter,
  NewGameAndEnterContext,
} from "./enterGame";
import { assertAsyncThrows } from "./helpers/test";

describe("LeaveGame Instruction Tests", () => {
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

    const newGameAndEnterContext: NewGameAndEnterContext =
      await setUpNewGameAndEnter(program, {
        newGame: {
          gameId: gameId,
          gameAddress: goodGameAddress,
        },
      });

    await assertAsyncThrows(
      () =>
        setUpLeaveGame(
          program,
          newGameAndEnterContext.newGame,
          newGameAndEnterContext,
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

  it.only("leave game > game - bad seed - game ID > fails", async () => {
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

    const newGameAndEnterContext: NewGameAndEnterContext =
      await setUpNewGameAndEnter(program, {
        newGame: {
          gameId: gameId,
          gameAddress: goodGameAddress,
        },
      });

    await assertAsyncThrows(
      () =>
        setUpLeaveGame(
          program,
          newGameAndEnterContext.newGame,
          newGameAndEnterContext,
          {
            gameAddress: badGameAddress,
          }
        )
    );
  });

  it("leave game > game - wrong game creator > fails", async () => {
    await assertAsyncThrows(
      () =>
        setUpNewGameEnterAndLeave(program, {
          gameCreator: Keypair.generate().publicKey,
        }),
      "GameCreatorMismatch"
    );
  });

  it("leave game > player - bad seed - seed > fails", async () => {
    const newGameAndEnterContext: NewGameAndEnterContext =
      await setUpNewGameAndEnter(program);

    const badPlayerStateAddress: PublicKey = (
      await PublicKey.findProgramAddress(
        [
          anchor.utils.bytes.utf8.encode("this player sucks"),
          newGameAndEnterContext.newGame.gameAddress.toBuffer(),
          newGameAndEnterContext.playerWallet.publicKey.toBuffer(),
        ],
        program.programId
      )
    )[0];

    await assertAsyncThrows(() =>
      setUpLeaveGame(
        program,
        newGameAndEnterContext.newGame,
        newGameAndEnterContext,
        {
          playerWallet: newGameAndEnterContext.playerWallet,
          playerStateAddress: badPlayerStateAddress,
        }
      )
    );
  });

  it("leave game > player - bad seed - game  > fails", async () => {
    const newGameAndEnterContext: NewGameAndEnterContext =
      await setUpNewGameAndEnter(program);

    const badPlayerStateAddress: PublicKey = (
      await PublicKey.findProgramAddress(
        [
          anchor.utils.bytes.utf8.encode(PLAYER_SEED),
          Keypair.generate().publicKey.toBuffer(),
          newGameAndEnterContext.playerWallet.publicKey.toBuffer(),
        ],
        program.programId
      )
    )[0];

    await assertAsyncThrows(() =>
      setUpLeaveGame(
        program,
        newGameAndEnterContext.newGame,
        newGameAndEnterContext,
        {
          playerWallet: newGameAndEnterContext.playerWallet,
          playerStateAddress: badPlayerStateAddress,
        }
      )
    );
  });

  it("leave game > player - bad seed - payer > fails", async () => {
    const newGameAndEnterContext: NewGameAndEnterContext =
      await setUpNewGameAndEnter(program);

    const badPlayerStateAddress: PublicKey = (
      await PublicKey.findProgramAddress(
        [
          anchor.utils.bytes.utf8.encode(PLAYER_SEED),
          newGameAndEnterContext.newGame.gameAddress.toBuffer(),
          Keypair.generate().publicKey.toBuffer(),
        ],
        program.programId
      )
    )[0];

    await assertAsyncThrows(() =>
      setUpLeaveGame(
        program,
        newGameAndEnterContext.newGame,
        newGameAndEnterContext,
        {
          playerWallet: newGameAndEnterContext.playerWallet,
          playerStateAddress: badPlayerStateAddress,
        }
      )
    );
  });

  it("leave game > player - owner isnt program > fails", async () => {
    const newGameAndEnterContext: NewGameAndEnterContext =
      await setUpNewGameAndEnter(program);

    const badPlayerStateAddress: PublicKey = (
      await PublicKey.findProgramAddress(
        [
          anchor.utils.bytes.utf8.encode(PLAYER_SEED),
          newGameAndEnterContext.newGame.gameAddress.toBuffer(),
          newGameAndEnterContext.playerWallet.publicKey.toBuffer(),
        ],
        anchor.web3.SystemProgram.programId
      )
    )[0];

    await assertAsyncThrows(() =>
      setUpLeaveGame(
        program,
        newGameAndEnterContext.newGame,
        newGameAndEnterContext,
        {
          playerWallet: newGameAndEnterContext.playerWallet,
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
        setUpNewGameEnterAndLeave(program, {
          playerTokenAccount: wrongTokenAccount,
        }),
      "InvalidWinningsDestinationMint"
    );
  });

  it("leave game > token_pool - wrong mint > fails", async () => {});

  it("leave game > token_pool - wrong owner > fails", async () => {});

  it("leave game > equilibrate_program - wrong program ID > fails", async () => {});

  it("leave game > bucket balances update correctly", async () => {});

  it("leave game > token pool balance remains consistent", async () => {});

  it("leave game > last player to leave > gets remaining tokens", async () => {});

  it("leave game > last player to leave > game is closed and rent returned to creator", async () => {});

  it("leave game > game creator is only one to play > gets remaining tokens", async () => {});

  it("leave game > game creator is only one to play > game is closed and rent returned to creator", async () => {});

  it("leave game > non-last player to leave > gets proportion of their bucket tokens", async () => {});

  it("leave game > player state account is closed and rent returned to payer", async () => {});
});

export interface NewGameEnterAndLeaveSetupArgs extends LeaveGameSetupArgs {
  newGame?: NewGameSetupArgs;
  enterGame?: EnterGameSetupArgs;
}

export interface LeaveGameSetupArgs {
  gameAddress?: PublicKey;
  gameCreator?: PublicKey;
  playerStateAddress?: PublicKey;
  playerWallet?: Keypair;
  playerTokenAccount?: PublicKey;
}

export interface LeaveGameContext {}

export interface NewGameEnterAndLeaveContext extends LeaveGameContext {
  newGame: NewGameContext;
  enterGame: EnterGameContext;
}

export async function setUpNewGameEnterAndLeave(
  program: anchor.Program<Equilibrate>,
  customSetup?: NewGameEnterAndLeaveSetupArgs
): Promise<NewGameEnterAndLeaveContext> {
  const newGameContext: NewGameContext = await setUpNewGame(
    program,
    customSetup?.newGame
  );

  const enterGameContext: EnterGameContext = await setUpEnterGame(
    program,
    newGameContext,
    customSetup?.enterGame
  );

  const leaveGameContext: LeaveGameContext = await setUpLeaveGame(
    program,
    newGameContext,
    enterGameContext,
    customSetup
  );

  return {
    ...leaveGameContext,
    newGame: newGameContext,
    enterGame: enterGameContext,
  };
}

async function setUpLeaveGame(
  program: anchor.Program<Equilibrate>,
  newGameContext: NewGameContext,
  enterGameContext: EnterGameContext,
  customSetup?: LeaveGameSetupArgs,
  debug: boolean = false
): Promise<LeaveGameContext> {
  if (!testIsReady()) throw new Error("not ready");
  const connection: Connection = program.provider.connection;

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
    playerTokenAccount = await getAssociatedTokenAddress(newGameContext.mint.publicKey, customSetup?.playerWallet.publicKey);
  } else {
    playerTokenAccount = enterGameContext.playerTokenAccount;
  }

  try {
    await program.methods
      .leaveGame()
      .accountsStrict({
        game: customSetup?.gameAddress ?? newGameContext.gameAddress,
        gameCreator:
          customSetup?.gameCreator ?? newGameContext.playerWallet.publicKey,
        player: playerStateAddress,
        winningsDestinationAccount: playerTokenAccount,
        tokenPool: newGameContext.tokenPoolAddress,
        equilibrateProgram: program.programId,
        payer: enterGameContext.playerWallet.publicKey,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([enterGameContext.playerWallet])
      .rpc();
  } catch (e) {
    if (debug) {
      console.log(JSON.stringify(e));
    }
    throw e;
  }

  return {};
}
