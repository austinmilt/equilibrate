import * as anchor from "@project-serum/anchor";
import { Equilibrate } from "../target/types/equilibrate";
import {
  generateBucketIndex as chooseBucket,
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
  makeAndFundWallet,
  makeAndFundWalletWithTokens,
  makeAssociatedTokenAccountWithPayer,
  MINT_DECIMALS,
  withoutDecimals,
} from "./helpers/token";
import { Game, GameConfig, GameState, PlayerState } from "./helpers/types";
import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import {
  GAME_SEED,
  getGameAddress,
  getPlayerStateAddress,
  PLAYER_SEED,
} from "./helpers/address";
import { assert } from "chai";
import { assertAsyncThrows, repeat } from "./helpers/test";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { NewGameContext, NewGameSetupArgs, setUpNewGame } from "./newGame";

describe("enter game Instruction Tests", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.Equilibrate as anchor.Program<Equilibrate>;

  it("enter game > all good > player is deposited into correct bucket", async () => {
    const {
      playerStateAddress,
      newGame: { gameAddress },
      playerBucketIndex,
    } = await setUpNewGameAndEnter(program);

    const playerState: PlayerState = await getPlayerState(
      playerStateAddress,
      program
    );
    const game: Game = await getGame(gameAddress, program);

    const expectedBucketPlayerCount: number = playerBucketIndex === 0 ? 2 : 1;

    assert.strictEqual(playerState.bucket.toNumber(), playerBucketIndex);
    assert.strictEqual(
      game.state.buckets[playerBucketIndex].players,
      expectedBucketPlayerCount
    );
  });

  it("enter game > all good > program fee is transferred", async () => {
    const connection: Connection = program.provider.connection;
    // appears that wallet balances (all ledger transactions?) carry over
    // across tests, so we need to check the change in balance rather than the
    // whole balance, since other tests may put program fee in the wallet
    const programFeeDestinatonBalancePreGame: number = await getSolBalance(
      PROGRAM_FEE_DESTINATION,
      connection
    );
    const nOtherPlayers: number = Math.round(Math.random() * 10) + 1;

    await setUpNewGameAndEnter(program, {
      otherPlayers: nOtherPlayers,
    });

    const programFeeDestinationBalance: number = await getSolBalance(
      PROGRAM_FEE_DESTINATION,
      connection
    );
    const programFeeSol: number =
      PROGRAM_FEE_LAMPORTS / anchor.web3.LAMPORTS_PER_SOL;
    assert.approximately(
      // double the fee to account for first and second player
      (nOtherPlayers + 1) * programFeeSol,
      programFeeDestinationBalance - programFeeDestinatonBalancePreGame,
      1 / anchor.web3.LAMPORTS_PER_SOL
    );
    // It would be great to also check that the player's balance went
    // down by the program fee, but without knowing solana's transaction
    // fee we cant calculate what the new balance should be. That's OK,
    // though, since the only source of income to the fee destination is
    // the player's account
  });

  it("enter game > all good > game tokens are transfered", async () => {
    const connection: Connection = program.provider.connection;
    const nOtherPlayers: number = Math.round(Math.random() * 10) + 1;
    const {
      playerWallet,
      newGame: { mint, gameConfig },
      playerStartingTokens,
    } = await setUpNewGameAndEnter(program, {
      otherPlayers: nOtherPlayers,
    });

    const playerTokenBalance: number = await getTokenBalanceWithoutDecimals(
      playerWallet.publicKey,
      mint.publicKey,
      connection
    );
    const tokenPoolBalance: number = await getTokenBalanceWithoutDecimals(
      program.programId,
      mint.publicKey,
      connection
    );
    const entryFeeWithoutDecimals: number = withoutDecimals(
      gameConfig.entryFeeDecimalTokens.toNumber(),
      MINT_DECIMALS
    );
    assert.approximately(
      (nOtherPlayers + 1) * entryFeeWithoutDecimals,
      tokenPoolBalance,
      Math.pow(10, -MINT_DECIMALS)
    );
    assert.approximately(
      entryFeeWithoutDecimals,
      playerStartingTokens - playerTokenBalance,
      Math.pow(10, -MINT_DECIMALS)
    );
  });

  it.only("enter game > all good > bucket balances update correctly", repeat(10, async () => {

    //TODO With the current game setup, the most strategic thing to do is enter a game
    //TODO and bucket with no other players and and immediatley leave, because you're
    //TODO very likely to get your fee + some balance back. This way, the game will never
    //TODO grow to something interesting because people will just sap funds away from
    //TODO the game maker
    // const nOtherPlayers: number = Math.ceil(Math.random() * 10) + 1;
    const nOtherPlayers: number = 10;
    const { newGame: newGameContext } = await setUpNewGameAndEnter(program, {
      otherPlayers: nOtherPlayers - 1,
      //TODO revert
      newGame: {
        gameConfig: {
          entryFeeDecimalTokens: new anchor.BN(1 * Math.pow(10, MINT_DECIMALS)),
          nBuckets: new anchor.BN(3),
          spillRateDecimalTokensPerSecondPerPlayer: new anchor.BN(1 * Math.pow(10, MINT_DECIMALS))
        },
      },
    });

    const gameStateBeforeWeEnter: GameState = (
      await getGame(newGameContext.gameAddress, program)
    ).state;

    await setUpEnterGame(program, newGameContext);

    const gameStateAfterWeEnter: GameState = (
      await getGame(newGameContext.gameAddress, program)
    ).state;

    const tokenPoolBalance: number = await getTokenBalanceWithoutDecimals(
      program.programId,
      newGameContext.gameConfig.mint,
      program.provider.connection
    );
    const bucketTokenTotal: number = gameStateAfterWeEnter.buckets.reduce(
      (partialSum, b) => partialSum + b.decimalTokens.toNumber(),
      0
    );
    const expectedTokenTotal: number =
      (nOtherPlayers + 1) *
      newGameContext.gameConfig.entryFeeDecimalTokens.toNumber();
    console.log(`\nplayers = ${nOtherPlayers + 1}`);
    console.log(
      `fee = ${(
        newGameContext.gameConfig.entryFeeDecimalTokens.toNumber() * 1e-9
      ).toFixed(3)}`
    );
    console.log(`expected = ${(expectedTokenTotal * 1e-9).toFixed(3)}`);
    console.log(`pool = ${tokenPoolBalance.toFixed(3)}`);
    console.log(`bucket = ${(bucketTokenTotal * 1e-9).toFixed(3)}`);
    console.log(
      `(bucket - expected)/fee = ${(
        (bucketTokenTotal - expectedTokenTotal) /
        newGameContext.gameConfig.entryFeeDecimalTokens.toNumber()
      ).toFixed(3)}`
    );
    assert.strictEqual(bucketTokenTotal, expectedTokenTotal);

    //TODO revert
    // assert.fail("check that the total in each bucket is correct");
  }));

  it("enter game > game is at capacity > bucket balances update correctly", async () => {
    assert.fail();
  });

  it("enter game > game is at capacity > fails", async () => {
    assert.fail();
  });

  it("enter game > game - bad seed - seed > fails", async () => {
    assert.fail();
  });

  it("enter game > game - bad seed - game ID > fails", async () => {
    assert.fail();
  });

  it("enter game > player - bad seed - seed > fails", async () => {
    assert.fail();
  });

  it("enter game > player - bad seed - game > fails", async () => {
    assert.fail();
  });

  it("enter game > player - bad seed - payer > fails", async () => {
    assert.fail();
  });

  it("enter game > player - wrong account owner > fails", async () => {
    assert.fail();
  });

  it("enter game > player - wrong game > fails", async () => {
    assert.fail();
  });

  it("enter game > program fee destination is wrong > fails", async () => {
    assert.fail();
  });

  it("enter game > deposit source account - mint doesnt match game > fails", async () => {
    assert.fail();
  });

  it("enter game > token pool - wrong mint > fails", async () => {
    assert.fail();
  });

  it("enter game > token pool - owner isnt program > fails", async () => {
    assert.fail();
  });

  it("enter game > invalid bucket index > fails", async () => {
    assert.fail();
  });

  it("enter game > game hasnt been created > fails", async () => {
    assert.fail();
  });
});

export interface NewGameAndEnterSetupArgs extends EnterGameSetupArgs {
  newGame?: NewGameSetupArgs;
}

export interface EnterGameSetupArgs {
  otherPlayers?: number;
  playerBucketIndex?: number;
  playerStartingSol?: number;
  playerStartingTokens?: number;
  playerWallet?: Keypair;
  playerTokenAccount?: PublicKey;
  playerStateAddress?: PublicKey;
  programFeeDestination?: PublicKey;
}

export interface EnterGameContext {
  playerStartingSol: number;
  playerStartingTokens: number;
  playerWallet: Keypair;
  playerTokenAccount: PublicKey;
  playerStateAddress: PublicKey;
  playerBucketIndex: number;
}

export interface NewGameAndEnterContext extends EnterGameContext {
  newGame: NewGameContext;
}

export async function setUpNewGameAndEnter(
  program: anchor.Program<Equilibrate>,
  customSetup?: NewGameAndEnterSetupArgs
): Promise<NewGameAndEnterContext> {
  const connection: Connection = program.provider.connection;
  const newGameContext: NewGameContext = await setUpNewGame(
    program,
    customSetup?.newGame
  );

  const enterGameContext: EnterGameContext = await setUpEnterGame(
    program,
    newGameContext,
    customSetup
  );

  return {
    ...enterGameContext,
    newGame: newGameContext,
  };
}

async function setUpEnterGame(
  program: anchor.Program<Equilibrate>,
  newGameContext: NewGameContext,
  customSetup?: EnterGameSetupArgs
): Promise<EnterGameContext> {
  const connection: Connection = program.provider.connection;

  const nonFirstPlayersToEnter: number =
    customSetup?.otherPlayers == null ? 1 : customSetup.otherPlayers;
  if (nonFirstPlayersToEnter < 1) {
    throw new Error(
      "otherPlayers must be > 0. It includes the first player that made the game"
    );
  }

  let playerTokens: number;
  let playerStartingSol: number;
  let player: Keypair;
  let playerTokenAccount: PublicKey;
  let playerStateAddress: PublicKey;
  let bucketIndex: number;
  // the last player entered will be the one used in the test
  for (let i = 0; i < nonFirstPlayersToEnter; i++) {
    playerTokens =
      customSetup?.playerStartingTokens != null
        ? customSetup?.playerStartingTokens
        : Math.ceil(
            1.1 *
              withoutDecimals(
                newGameContext.gameConfig.entryFeeDecimalTokens.toNumber(),
                MINT_DECIMALS
              )
          );

    playerStartingSol =
      customSetup?.playerStartingSol != null
        ? customSetup?.playerStartingSol
        : (10 * PROGRAM_FEE_LAMPORTS) / anchor.web3.LAMPORTS_PER_SOL;

    const fundResult = await makeAndFundWalletWithTokens(
      playerStartingSol,
      playerTokens,
      newGameContext.mint.publicKey,
      newGameContext.mintAuthority,
      connection
    );
    player = fundResult.wallet;
    playerTokenAccount = fundResult.tokenAccount;

    if (customSetup?.playerWallet != null) player = customSetup?.playerWallet;

    if (customSetup?.playerTokenAccount != null) {
      playerTokenAccount = customSetup?.playerTokenAccount;
    }

    playerStateAddress =
      customSetup?.playerStateAddress ??
      (await getPlayerStateAddress(
        newGameContext.gameAddress,
        player.publicKey,
        program.programId
      ));

    bucketIndex =
      customSetup?.playerBucketIndex == null
        ? chooseBucket(newGameContext.gameConfig.nBuckets.toNumber())
        : customSetup?.playerBucketIndex;

    try {
      await program.methods
        .enterGame(new anchor.BN(bucketIndex))
        .accountsStrict({
          game: newGameContext.gameAddress,
          player: playerStateAddress,
          programFeeDestination:
            customSetup?.programFeeDestination ?? PROGRAM_FEE_DESTINATION,
          depositSourceAccount: playerTokenAccount,
          tokenPool: newGameContext.tokenPoolAddress,
          payer: player.publicKey,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([player])
        .rpc();
    } catch (e) {
      console.log(JSON.stringify(e));
      throw e;
    }
  }

  return {
    playerStartingSol,
    playerStartingTokens: playerTokens,
    playerWallet: player,
    playerTokenAccount,
    playerStateAddress,
    playerBucketIndex: bucketIndex,
  };
}
