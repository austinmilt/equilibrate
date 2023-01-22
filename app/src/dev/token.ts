import { Keypair, Connection, PublicKey } from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import * as spl from "@solana/spl-token";
import { token } from "@project-serum/anchor/dist/cjs/utils";

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

export async function makeAssociatedTokenAccountWithPayer(
    payer: Keypair,
    owner: PublicKey,
    mint: PublicKey,
    connection: Connection
): Promise<PublicKey> {
    return await spl.createAssociatedTokenAccount(connection, payer, mint, owner);
}


export async function sendTokens(
    payer: Keypair,
    owner: PublicKey,
    mint: PublicKey,
    amount: number,
    connection: Connection
): Promise<string> {
    const fromAssociatedAccount: PublicKey = await spl.getAssociatedTokenAddress(mint, payer.publicKey);
    const toAssociatedAccount: spl.Account = await spl.getOrCreateAssociatedTokenAccount(
        connection,
        payer,
        mint,
        owner
    );
    const mintDecimals: number = await getMintDecimals(mint, connection);
    return await spl.transferChecked(
        connection,
        payer,
        fromAssociatedAccount,
        mint,
        toAssociatedAccount.address,
        payer,
        amount,
        mintDecimals
    );
}


async function getMintDecimals(mint: PublicKey, connection: Connection): Promise<number> {
    const info = await connection.getParsedAccountInfo(mint);
    if (info.value == null) {
        throw new Error("Could not get mint decimals.");
    }
    return (info.value.data as anchor.web3.ParsedAccountData).parsed.info.decimals as number;
}


export async function getTokenBalance(mint: PublicKey, owner: PublicKey, connection: Connection): Promise<number> {
    const tokenAccountAddress: PublicKey = await spl.getAssociatedTokenAddress(mint, owner);
    const account = await spl.getAccount(connection, tokenAccountAddress);
    return new Number(account.amount).valueOf();
}
