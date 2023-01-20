import { Keypair, Connection, PublicKey } from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import * as spl from "@solana/spl-token";

const MINT_DECIMALS: number = 9;

export async function generateMintAndMintToWallet(
    owner: PublicKey,
    tokens: number,
    connection: Connection
): Promise<{ mint: Keypair, authority: Keypair, ownerTokenAccount: PublicKey, transactionId: string }> {
    const mintAuthority: Keypair = await makeAndFundWallet(10, connection);
    const mint: Keypair = await generateMint(mintAuthority, connection);
    const ownerTokenAccount: PublicKey = await makeAssociatedTokenAccountWithPayer(
        mintAuthority,
        owner,
        mint.publicKey,
        connection
    );
    const transactionId: string = await mintTokensToWallet(
        ownerTokenAccount,
        tokens,
        mint.publicKey,
        mintAuthority,
        connection
    );
    return {
        mint: mint,
        authority: mintAuthority,
        ownerTokenAccount: ownerTokenAccount,
        transactionId: transactionId
    };
}

async function generateMint(
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

async function makeAndFundWallet(
    sol: number,
    connection: Connection
): Promise<Keypair> {
    const wallet: Keypair = Keypair.generate();
    await fundWallet(wallet.publicKey, sol, connection);
    return wallet;
}

async function fundWallet(
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

async function mintTokensToWallet(
    destinationTokenAccount: PublicKey,
    amountWithoutDecimals: number,
    mint: PublicKey,
    mintAuthority: Keypair,
    connection: Connection
): Promise<string> {
    return await spl.mintTo(
        connection,
        mintAuthority,
        mint,
        destinationTokenAccount,
        mintAuthority,
        amountWithoutDecimals * Math.pow(10, MINT_DECIMALS)
    );
}

async function makeAssociatedTokenAccountWithPayer(
    payer: Keypair,
    owner: PublicKey,
    mint: PublicKey,
    connection: Connection
): Promise<PublicKey> {
    return await spl.createAssociatedTokenAccount(connection, payer, mint, owner);
}
