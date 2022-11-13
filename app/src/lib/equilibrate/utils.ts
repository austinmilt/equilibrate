import { Connection, PublicKey } from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import * as spl from "@solana/spl-token";
import { GAME_SEED, PLAYER_SEED, POOL_SEED, POOL_MANAGER_SEED } from "./constants";
import { Game } from "./types";
import { Equilibrate } from "../../../../target/types/equilibrate";

export async function getGameAddress(
    gameId: number,
    programId: PublicKey
): Promise<PublicKey> {
    return (await PublicKey.findProgramAddress(
        [
            anchor.utils.bytes.utf8.encode(GAME_SEED),
            new anchor.BN(gameId).toArrayLike(Buffer, "le", 8),
        ],
        programId
    ))[0];
}


export async function getPlayerStateAddress(
    game: PublicKey,
    player: PublicKey,
    programId: PublicKey
): Promise<PublicKey> {
    return (await PublicKey.findProgramAddress(
        [
            anchor.utils.bytes.utf8.encode(PLAYER_SEED),
            game.toBuffer(),
            player.toBuffer(),
        ],
        programId
    ))[0];
}


export async function getTokenPoolAddress(
    mint: PublicKey,
    programId: PublicKey
): Promise<PublicKey> {
    return (await PublicKey.findProgramAddress(
        [
            anchor.utils.bytes.utf8.encode(POOL_SEED),
            mint.toBuffer(),
            (await getPoolManagerAddress(mint, programId))[0].toBuffer()
        ],
        programId
    ))[0];
}


export async function getPoolManagerAddress(
    mint: PublicKey,
    programId: PublicKey
): Promise<[PublicKey, number]> {
    return (await PublicKey.findProgramAddress(
        [
            anchor.utils.bytes.utf8.encode(POOL_MANAGER_SEED),
            mint.toBuffer(),
        ],
        programId
    ));
}


export async function getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): Promise<PublicKey> {
    return await spl.getAssociatedTokenAddress(mint, owner);
}


export async function getMintDecimals(mint: PublicKey, connection: Connection): Promise<number> {
    return (await connection.getTokenSupply(mint)).value.decimals;
}


export async function accountExists(address: PublicKey, connection: Connection): Promise<boolean> {
    const account: anchor.web3.AccountInfo<Buffer> | null = await connection.getAccountInfo(address);
    return (account !== null) && (account.data.length > 0);
}
