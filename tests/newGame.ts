import * as anchor from "@project-serum/anchor";
import { Equilibrate } from "../target/types/equilibrate";
import {
  generateGameConfig,
  generateGameId,
  PROGRAM_FEE_DESTINATION,
} from "./helpers/game";
import {
  generateMint,
  makeAndFundWallet,
  makeAndFundWalletWithTokens,
  makeAssociatedTokenAccount,
  makeAssociatedTokenAccountWithPayer,
  mintTokensToWallet,
  MINT_DECIMALS,
} from "./helpers/token";
import { Game, GameConfig } from "./helpers/types";
import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import { getGameAddress, getPlayerStateAddress } from "./helpers/address";
import { assert } from "chai";

describe("New Game Instruction Tests", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.Equilibrate as anchor.Program<Equilibrate>;

  it("Create a new game > all good > game is created with expected config", async () => {
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
        (config.entryFeeDecimalTokens.toNumber() / Math.pow(10, MINT_DECIMALS))
    );
    const { wallet: player, tokenAccount: playerTokenAccount } =
      await makeAndFundWalletWithTokens(
        5,
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
    const tokenPoolAddress: PublicKey =
      await makeAssociatedTokenAccountWithPayer(
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

      //TODO figure out type of buckets
    // const game: Game = await program.account.game.fetch(gameAddress);
    const game = await program.account.game.fetch(gameAddress);
    assert(game.config === config, 'configs mismatch');
    console.log(Object.keys(game.state.buckets), game.state.buckets[0], game.state.buckets)
  });

  it("Create a new game > all good > program fee is transferred", async () => {
    assert(false);
  });

  it("Create a new game > all good > game tokens are transfered", async () => {
    assert(false);
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
