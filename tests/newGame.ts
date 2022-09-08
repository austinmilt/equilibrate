import * as anchor from "@project-serum/anchor";
import { Equilibrate } from "../target/types/equilibrate";
import {
  generateGameConfig,
  generateGameId,
  PROGRAM_FEE_DESTINATION,
  PROGRAM_FEE_LAMPORTS,
} from "./helpers/game";
import {
  fundWallet,
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
import { getGameAddress, getPlayerStateAddress } from "./helpers/address";
import { assert } from "chai";

describe("New Game Instruction Tests", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.Equilibrate as anchor.Program<Equilibrate>;

  it("Create a new game > all good > game config and initial state are as expected", async () => {
    const {
      playerWallet,
      gameConfig,
      gameAddress,
      gameId,
      playerStateAddress,
    } = await setUp(program);

    const game: Game = (await program.account.game.fetch(gameAddress)) as Game;
    assert.strictEqual(
      game.config.entryFeeDecimalTokens.toNumber(),
      gameConfig.entryFeeDecimalTokens.toNumber()
    );
    assert.strictEqual(
      game.config.nBuckets.toNumber(),
      gameConfig.nBuckets.toNumber()
    );
    assert.strictEqual(
      game.config.spillRateDecimalTokensPerSecondPerPlayer.toNumber(),
      gameConfig.spillRateDecimalTokensPerSecondPerPlayer.toNumber()
    );
    assert.strictEqual(
      game.config.token.toBase58(),
      gameConfig.token.toBase58()
    );
    assert.strictEqual(
      game.creator.toBase58(),
      playerWallet.publicKey.toBase58()
    );
    assert.strictEqual(game.id.toNumber(), gameId);
    assert.strictEqual(
      game.state.buckets.length,
      gameConfig.nBuckets.toNumber()
    );
    assert.strictEqual(game.state.buckets[0].players, 1);
    assert.strictEqual(
      game.state.buckets[0].decimalTokens.toNumber(),
      gameConfig.entryFeeDecimalTokens.toNumber()
    );

    const firstPlayerState: PlayerState =
      await program.account.playerState.fetch(playerStateAddress);
    assert.strictEqual(firstPlayerState.bucket.toNumber(), 0);
    assert.strictEqual(
      firstPlayerState.game.toBase58(),
      gameAddress.toBase58()
    );
  });

  it("Create a new game > all good > program fee is transferred", async () => {
    const connection: Connection = program.provider.connection;
    // appears that wallet balances (all ledger transactions?) carry over 
    // across tests, so we need to check the change in balance rather than the 
    // whole balance, since other tests may put program fee in the wallet
    const programFeeDestinatonBalancePreGame: number = await getSolBalance(
      PROGRAM_FEE_DESTINATION,
      connection);

     await setUp(program);

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

  it("Create a new game > all good > game tokens are transfered", async () => {
    const connection: Connection = program.provider.connection;
    const { playerWallet, mint, gameConfig, playerStartingTokens } =
      await setUp(program);

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

  it("Create a new game > game - bad seed - seed > fails", async () => {
    assert(false);
  });

  it("Create a new game > game - bad seed - gameId > fails", async () => {
    assert(false);
  });

  it("Create a new game > firstPlayer - bad seed - seed > fails", async () => {
    assert(false);
  });

  it("Create a new game > firstPlayer - bad seed - game > fails", async () => {
    assert(false);
  });

  it("Create a new game > firstPlayer - bad seed - player > fails", async () => {
    assert(false);
  });

  it("Create a new game > wrong program fee destination > fails", async () => {
    assert(false);
  });

  it("Create a new game > wrong token source mint > fails", async () => {
    assert(false);
  });

  it("Create a new game > wrong token pool mint > fails", async () => {
    assert(false);
  });

  it("Create a new game > token pool owner is not game program > fails", async () => {
    assert(false);
  });

  it("Create a new game > entry fee is non-positive > fails", async () => {
    assert(false);
  });

  it("Create a new game > too few game buckets > fails", async () => {
    assert(false);
  });

  it("Create a new game > too many game buckets > fails", async () => {
    assert(false);
  });

  it("Create a new game > spill rate is non-positive > fails", async () => {
    assert(false);
  });
});

interface NewGameContext {
  mintAuthority: Keypair;
  mint: Keypair;
  gameConfig: GameConfig;
  gameId: number;
  gameAddress: PublicKey;
  playerStartingSol: number;
  playerStartingTokens: number;
  playerWallet: Keypair;
  playerTokenAccount: PublicKey;
  playerStateAddress: PublicKey;
  tokenPoolAddress: PublicKey;
}

async function setUp(
  program: anchor.Program<Equilibrate>
): Promise<NewGameContext> {
  const connection: Connection = program.provider.connection;
  const mintAuthority: Keypair = await makeAndFundWallet(1, connection);
  const mint = await generateMint(mintAuthority, connection);
  const config: GameConfig = generateGameConfig(mint.publicKey);
  const gameId: number = generateGameId();
  const gameAddress: PublicKey = await getGameAddress(
    gameId,
    program.programId
  );
  const playerTokens: number = Math.ceil(
    1.1 *
      withoutDecimals(config.entryFeeDecimalTokens.toNumber(), MINT_DECIMALS)
  );
  const playerStartingSol: number = 10*PROGRAM_FEE_LAMPORTS / anchor.web3.LAMPORTS_PER_SOL;
  const { wallet: player, tokenAccount: playerTokenAccount } =
    await makeAndFundWalletWithTokens(
      playerStartingSol,
      playerTokens,
      mint.publicKey,
      mintAuthority,
      connection
    );
  const playerStateAddress: PublicKey = await getPlayerStateAddress(
    gameAddress,
    player.publicKey,
    program.programId
  );
  const tokenPoolAddress: PublicKey = await makeAssociatedTokenAccountWithPayer(
    mintAuthority,
    program.programId,
    mint.publicKey,
    connection
  );

  await program.methods
    .newGame(config, new anchor.BN(gameId))
    .accountsStrict({
      game: gameAddress,
      firstPlayer: playerStateAddress,
      programFeeDestination: PROGRAM_FEE_DESTINATION,
      depositSourceAccount: playerTokenAccount,
      tokenPool: tokenPoolAddress,
      payer: player.publicKey,
      associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    })
    .signers([player])
    .rpc();

  return {
    mintAuthority,
    mint,
    gameConfig: config,
    gameId,
    gameAddress,
    playerStartingSol,
    playerStartingTokens: playerTokens,
    playerWallet: player,
    playerTokenAccount,
    playerStateAddress,
    tokenPoolAddress,
  };
}
