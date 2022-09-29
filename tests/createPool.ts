import * as anchor from "@project-serum/anchor";
import * as spl from "@solana/spl-token";
import { Equilibrate } from "../target/types/equilibrate";
import {
  generateMint,
  getTokenBalanceWithoutDecimals,
  makeAndFundWallet,
  makeAndFundWalletWithTokens,
  MINT_DECIMALS,
  withDecimals,
} from "./helpers/token";
import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import { getPoolManagerAddress, getTokenPoolAddress, POOL_MANAGER_SEED, POOL_SEED } from "./helpers/address";
import { testIsReady } from "./setup";
import { assert } from "chai";
import { assertAsyncThrows } from "./helpers/test";

describe("CreatePool Instruction Tests", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.Equilibrate as anchor.Program<Equilibrate>;

  it("create pool > all good > able to transfer tokens into pool", async () => {
    const context: CreatePoolContext = await setUpCreatePool(program);
    const playerTokens: number = Math.round(Math.random() * 100) + 10;
    const transferAmount: number = Math.ceil(Math.random() * playerTokens);
    const { wallet, tokenAccount } = await makeAndFundWalletWithTokens(
      1,
      playerTokens,
      context.mint.publicKey,
      context.mintAuthority,
      program.provider.connection
    );
    await spl.transfer(
      program.provider.connection,
      wallet,
      tokenAccount,
      context.tokenPoolAddress,
      wallet,
      withDecimals(transferAmount, MINT_DECIMALS)
    );

    const balance = await program.provider.connection.getTokenAccountBalance(
      context.tokenPoolAddress
    );

    assert.strictEqual(balance.value.uiAmount, transferAmount);
  });

  it("create pool > all good > not able to transfer tokens out of pool", async () => {
    const context: CreatePoolContext = await setUpCreatePool(program);
    const playerTokens: number = Math.round(Math.random() * 100) + 10;
    const depositAmount: number = Math.ceil(Math.random() * playerTokens);
    const withdrawAmount: number = Math.ceil(Math.random() * depositAmount);
    const { wallet, tokenAccount } = await makeAndFundWalletWithTokens(
      1,
      playerTokens,
      context.mint.publicKey,
      context.mintAuthority,
      program.provider.connection
    );
    await spl.transfer(
      program.provider.connection,
      wallet,
      tokenAccount,
      context.tokenPoolAddress,
      wallet,
      withDecimals(depositAmount, MINT_DECIMALS)
    );

    assertAsyncThrows(() =>
      spl.transfer(
        program.provider.connection,
        wallet,
        context.tokenPoolAddress,
        tokenAccount,
        context.poolManagerAddress,
        withDecimals(withdrawAmount, MINT_DECIMALS)
      )
    );

    const balance = await program.provider.connection.getTokenAccountBalance(
      context.tokenPoolAddress
    );

    assert.strictEqual(balance.value.uiAmount, depositAmount);
  });

  it("create pool > pool_manager - bad seed - seed > fails", async () => {
    const connection: Connection = program.provider.connection;
    const authority: Keypair = await makeAndFundWallet(5, connection);
    const mint: Keypair = await generateMint(authority, connection);
    const poolManagerAddress: PublicKey = (
      await PublicKey.findProgramAddress(
        [
          anchor.utils.bytes.utf8.encode("a bad seed my dude"),
          mint.publicKey.toBuffer(),
        ],
        program.programId
      )
    )[0];

    assertAsyncThrows(() =>
      setUpCreatePool(program, {
        mint: mint,
        mintAuthority: authority,
        poolManagerAddress: poolManagerAddress,
      })
    );
  });

  it("create pool > pool_manager - bad seed - mint > fails", async () => {
    const connection: Connection = program.provider.connection;
    const authority: Keypair = await makeAndFundWallet(5, connection);
    const mint: Keypair = await generateMint(authority, connection);
    const poolManagerAddress: PublicKey = (
      await PublicKey.findProgramAddress(
        [
          anchor.utils.bytes.utf8.encode(POOL_MANAGER_SEED),
          (await generateMint(authority, connection)).publicKey.toBuffer(),
        ],
        program.programId
      )
    )[0];

    assertAsyncThrows(() =>
      setUpCreatePool(program, {
        mint: mint,
        mintAuthority: authority,
        poolManagerAddress: poolManagerAddress,
      })
    );
  });

  it("create pool > token_pool - bad seed - seed > fails", async () => {
    const connection: Connection = program.provider.connection;
    const authority: Keypair = await makeAndFundWallet(5, connection);
    const mint: Keypair = await generateMint(authority, connection);
    const poolManagerAddress: PublicKey = await getPoolManagerAddress(mint.publicKey, program.programId);
    const tokenPoolAddress: PublicKey = (
      await PublicKey.findProgramAddress(
        [
          anchor.utils.bytes.utf8.encode("a bad seed my dude"),
          mint.publicKey.toBuffer(),
          poolManagerAddress.toBuffer()
        ],
        program.programId
      )
    )[0];

    assertAsyncThrows(() =>
      setUpCreatePool(program, {
        mint: mint,
        mintAuthority: authority,
        poolManagerAddress: poolManagerAddress,
        tokenPoolAddress: tokenPoolAddress
      })
    );
  });

  it("create pool > token_pool - bad seed - mint > fails", async () => {
    const connection: Connection = program.provider.connection;
    const authority: Keypair = await makeAndFundWallet(5, connection);
    const mint: Keypair = await generateMint(authority, connection);
    const poolManagerAddress: PublicKey = await getPoolManagerAddress(mint.publicKey, program.programId);
    const tokenPoolAddress: PublicKey = (
      await PublicKey.findProgramAddress(
        [
          anchor.utils.bytes.utf8.encode(POOL_SEED),
          (await generateMint(await makeAndFundWallet(1, connection), connection)).publicKey.toBuffer(),
          poolManagerAddress.toBuffer()
        ],
        program.programId
      )
    )[0];

    assertAsyncThrows(() =>
      setUpCreatePool(program, {
        mint: mint,
        mintAuthority: authority,
        poolManagerAddress: poolManagerAddress,
        tokenPoolAddress: tokenPoolAddress
      })
    );
  });

  it("create pool > token_pool - bad seed - manager > fails", async () => {
    const connection: Connection = program.provider.connection;
    const authority: Keypair = await makeAndFundWallet(5, connection);
    const mint: Keypair = await generateMint(authority, connection);
    const poolManagerAddress: PublicKey = await getPoolManagerAddress(mint.publicKey, program.programId);
    const tokenPoolAddress: PublicKey = (
      await PublicKey.findProgramAddress(
        [
          anchor.utils.bytes.utf8.encode(POOL_SEED),
          mint.publicKey.toBuffer(),
          Keypair.generate().publicKey.toBuffer()
        ],
        program.programId
      )
    )[0];

    assertAsyncThrows(() =>
      setUpCreatePool(program, {
        mint: mint,
        mintAuthority: authority,
        poolManagerAddress: poolManagerAddress,
        tokenPoolAddress: tokenPoolAddress
      })
    );
  });
});

export interface CreatePoolSetupArgs {
  mintAuthority?: Keypair;
  mint?: Keypair;
  tokenPoolAddress?: PublicKey;
  poolManagerAddress?: PublicKey;
}

export interface CreatePoolContext {
  mintAuthority: Keypair;
  mint: Keypair;
  tokenPoolAddress: PublicKey;
  poolManagerAddress: PublicKey;
}

export async function setUpCreatePool(
  program: anchor.Program<Equilibrate>,
  customSetup?: CreatePoolSetupArgs,
  debug: boolean = false
): Promise<CreatePoolContext> {
  if (!testIsReady()) throw new Error("not ready");
  const connection: Connection = program.provider.connection;
  const mintAuthority: Keypair =
    customSetup?.mintAuthority ?? (await makeAndFundWallet(1, connection));
  const mint =
    customSetup?.mint ?? (await generateMint(mintAuthority, connection));

  const poolManagerAddress: PublicKey =
    customSetup?.poolManagerAddress ??
    (await getPoolManagerAddress(mint.publicKey, program.programId));

  const tokenPoolAddress: PublicKey =
    customSetup?.tokenPoolAddress ??
    (await getTokenPoolAddress(mint.publicKey, program.programId));

  const payer: Keypair = await makeAndFundWallet(5, connection);

  try {
    await program.methods
      .createPool()
      .accountsStrict({
        poolManager: poolManagerAddress,
        gameMint: mint.publicKey,
        tokenPool: tokenPoolAddress,
        payer: payer.publicKey,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([payer])
      .rpc();
  } catch (e) {
    if (debug) {
      console.log(e);
    }
    throw e;
  }

  return {
    mintAuthority,
    mint,
    tokenPoolAddress,
    poolManagerAddress,
  };
}
