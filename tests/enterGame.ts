import * as anchor from "@project-serum/anchor";
import { Equilibrate } from "../target/types/equilibrate";
import {
  generateBucketIndex,
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
import { NewGameContext, NewGameSetupArgs, setUpNewGame } from "./newGame";

describe("enter game Instruction Tests", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.Equilibrate as anchor.Program<Equilibrate>;

  it("enter game > all good > player is deposited into correct bucket", async () => {
    const { playerStateAddress, newGame: {gameAddress}, playerBucketIndex } = await setUpEnterGame(program);

    const playerState: PlayerState = await getPlayerState(
      playerStateAddress,
      program
    );
    const game: Game = await getGame(gameAddress, program);

    const expectedBucketPlayerCount: number = playerBucketIndex === 0 ? 2 : 1;

    assert.strictEqual(playerState.bucket.toNumber(), playerBucketIndex);
    assert.strictEqual(game.state.buckets[playerBucketIndex].players, expectedBucketPlayerCount);
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

    await setUpEnterGame(program);

    const programFeeDestinationBalance: number = await getSolBalance(
      PROGRAM_FEE_DESTINATION,
      connection
    );
    const programFeeSol: number =
      PROGRAM_FEE_LAMPORTS / anchor.web3.LAMPORTS_PER_SOL;
    assert.approximately(
      programFeeSol,
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
    const { playerWallet, newGame: {mint, gameConfig}, playerStartingTokens } =
      await setUpEnterGame(program);

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

  it("enter game > all good > bucket balances update correctly", async () => {
    assert.fail();
  });

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
});

interface EnterGameSetupArgs {
  newGame?: NewGameSetupArgs;
  playerBucketIndex?: number;
  playerStartingSol?: number;
  playerStartingTokens?: number;
  playerWallet?: Keypair;
  playerTokenAccount?: PublicKey;
  playerStateAddress?: PublicKey;
  programFeeDestination?: PublicKey;
}

interface EnterGameContext {
  newGame: NewGameContext;
  playerStartingSol: number;
  playerStartingTokens: number;
  playerWallet: Keypair;
  playerTokenAccount: PublicKey;
  playerStateAddress: PublicKey;
  playerBucketIndex: number;
}

async function setUpEnterGame(
  program: anchor.Program<Equilibrate>,
  customSetup?: EnterGameSetupArgs
): Promise<EnterGameContext> {
  const connection: Connection = program.provider.connection;
  const newGameContext: NewGameContext = await setUpNewGame(
    program,
    customSetup?.newGame
  );

  const playerTokens: number =
    customSetup?.playerStartingTokens != null
      ? customSetup?.playerStartingTokens
      : Math.ceil(
          1.1 *
            withoutDecimals(
              newGameContext.gameConfig.entryFeeDecimalTokens.toNumber(),
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
      newGameContext.mint.publicKey,
      newGameContext.mintAuthority,
      connection
    );

  if (customSetup?.playerWallet != null) player = customSetup?.playerWallet;

  if (customSetup?.playerTokenAccount != null) {
    playerTokenAccount = customSetup?.playerTokenAccount;
  }

  const playerStateAddress: PublicKey =
    customSetup?.playerStateAddress ??
    (await getPlayerStateAddress(
      newGameContext.gameAddress,
      player.publicKey,
      program.programId
    ));

  const bucketIndex: number =
    customSetup?.playerBucketIndex == null
      ? generateBucketIndex(newGameContext.gameConfig.nBuckets.toNumber())
      : customSetup?.playerBucketIndex;

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

  return {
    newGame: newGameContext,
    playerStartingSol,
    playerStartingTokens: playerTokens,
    playerWallet: player,
    playerTokenAccount,
    playerStateAddress,
    playerBucketIndex: bucketIndex
  };
}
