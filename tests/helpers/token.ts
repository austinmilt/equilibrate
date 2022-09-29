import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import * as spl from "@solana/spl-token";
import * as anchor from "@project-serum/anchor";
import { getTokenPoolAddress } from "./address";

export const MINT_DECIMALS: number = 9;

export async function generateMint(
  authority: Keypair,
  connection: Connection
): Promise<Keypair> {
  const mint: Keypair = Keypair.generate();
  await spl.createMint(
    connection,
    authority,
    authority.publicKey,
    authority.publicKey,
    MINT_DECIMALS,
    mint
  );

  return mint;
}

export async function makeAndFundWalletWithTokens(
  sol: number,
  tokensWithoutDecimals: number,
  mint: PublicKey,
  mintAuthority: Keypair,
  connection: Connection
): Promise<{ wallet: Keypair; tokenAccount: PublicKey }> {
  const wallet: Keypair = await makeAndFundWallet(sol, connection);
  const tokenAccount: PublicKey = await makeAssociatedTokenAccount(
    wallet,
    mint,
    connection
  );

  await mintTokensToWallet(
    tokenAccount,
    tokensWithoutDecimals,
    mint,
    mintAuthority,
    connection
  );
  return { wallet: wallet, tokenAccount: tokenAccount };
}

export async function makeAndFundWallet(
  sol: number,
  connection: Connection
): Promise<Keypair> {
  const wallet: Keypair = Keypair.generate();
  await fundWallet(wallet.publicKey, sol, connection);
  return wallet;
}

export async function fundWallet(
  wallet: PublicKey,
  sol: number,
  connection: Connection
): Promise<void> {
  const airdropId: string = await connection.requestAirdrop(
    wallet,
    sol * anchor.web3.LAMPORTS_PER_SOL
  );

  const blockhash: { blockhash: string; lastValidBlockHeight: number } =
    await connection.getLatestBlockhash();

  await connection.confirmTransaction({
    ...blockhash,
    signature: airdropId,
  });
}

export async function mintTokensToWallet(
  destinationTokenAccount: PublicKey,
  amountWithoutDecimals: number,
  mint: PublicKey,
  mintAuthority: Keypair,
  connection: Connection
): Promise<void> {
  await spl.mintTo(
    connection,
    mintAuthority,
    mint,
    destinationTokenAccount,
    mintAuthority,
    amountWithoutDecimals * Math.pow(10, MINT_DECIMALS)
  );
}

export async function makeAssociatedTokenAccount(
  owner: Keypair,
  mint: PublicKey,
  connection: Connection
): Promise<PublicKey> {
  return await makeAssociatedTokenAccountWithPayer(
    owner,
    owner.publicKey,
    mint,
    connection
  );
}

export async function makeAssociatedTokenAccountWithPayer(
  payer: Keypair,
  owner: PublicKey,
  mint: PublicKey,
  connection: Connection
): Promise<PublicKey> {
  return await spl.createAssociatedTokenAccount(connection, payer, mint, owner);
}

export async function getTokenPoolBalanceWithoutDecimals(mint: PublicKey, programId: PublicKey, connection: Connection): Promise<number> {
  const address: PublicKey = await getTokenPoolAddress(mint, programId);
  return (await connection.getTokenAccountBalance(address)).value.uiAmount;
}

export async function getTokenPoolBalanceWithDecimals(mint: PublicKey, programId: PublicKey, connection: Connection): Promise<number> {
  const address: PublicKey = await getTokenPoolAddress(mint, programId);
  return Number.parseInt((await connection.getTokenAccountBalance(address)).value.amount);
}

export async function getTokenBalanceWithoutDecimals(owner: PublicKey, mint: PublicKey, connection: Connection): Promise<number> {
  const tokenAccountAddress: PublicKey = await spl.getAssociatedTokenAddress(mint, owner);
  return (await connection.getTokenAccountBalance(tokenAccountAddress)).value.uiAmount;
}

export async function getTokenBalanceWithDecimals(owner: PublicKey, mint: PublicKey, connection: Connection): Promise<number> {
  const tokenAccountAddress: PublicKey = await spl.getAssociatedTokenAddress(mint, owner);
  return Number.parseInt((await connection.getTokenAccountBalance(tokenAccountAddress)).value.amount);
}

export function withDecimals(amountWithoutDecimals: number, decimals: number): number {
  return amountWithoutDecimals * Math.pow(10, decimals);
}

export function withoutDecimals(amountWithDecimals: number, decimals: number): number {
  return amountWithDecimals / Math.pow(10, decimals);
}

export async function getSolBalance(wallet: PublicKey, connection: Connection): Promise<number> {
  return await connection.getBalance(wallet) / anchor.web3.LAMPORTS_PER_SOL;
}
