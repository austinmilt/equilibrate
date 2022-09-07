import { PublicKey } from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";

export async function getGameAddress(
  gameId: number,
  programId: PublicKey
): Promise<PublicKey> {
  return (await PublicKey.findProgramAddress(
    [
      anchor.utils.bytes.utf8.encode("equilibrate-game"),
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
      anchor.utils.bytes.utf8.encode("equilibrate-player"),
      game.toBuffer(),
      player.toBuffer(),
    ],
    programId
  ))[0];
}