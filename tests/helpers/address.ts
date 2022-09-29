import { PublicKey } from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import * as spl from '@solana/spl-token';

export const GAME_SEED: string = "equilibrate-game";
export const PLAYER_SEED: string = "equilibrate-player";
export const POOL_SEED: string = "equilibrate-pool";
export const POOL_MANAGER_SEED: string = "equilibrate-pool-manager";

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
      (await getPoolManagerAddress(mint, programId)).toBuffer()
    ],
    programId
  ))[0];
}


export async function getPoolManagerAddress(
  mint: PublicKey,
  programId: PublicKey
): Promise<PublicKey> {
  return (await PublicKey.findProgramAddress(
    [
      anchor.utils.bytes.utf8.encode(POOL_MANAGER_SEED),
      mint.toBuffer(),
    ],
    programId
  ))[0];
}


export async function getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): Promise<PublicKey> {
  return await spl.getAssociatedTokenAddress(mint, owner);
}
