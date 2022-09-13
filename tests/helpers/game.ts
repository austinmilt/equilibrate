import { Game, GameConfig, PlayerState } from "./types";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import { MINT_DECIMALS } from "./token";
import { Equilibrate } from "../../target/types/equilibrate";

export const PROGRAM_FEE_DESTINATION: PublicKey = new PublicKey('EQui1fSdC2HetpETDAoaLaPYvYR7xVuXmLyUiiEvfA2h');
export const PROGRAM_FEE_LAMPORTS: number = 15000000;
export const MAX_GAME_BUCKETS: number = 64

export function generateGameId(): number {
  // All we need is to ensure that each game is unique,
  // and using the epoch time in milliseconds will with very high
  // likelihood produce this result, while also conveniently
  // making games sequentially ordered
  return new Date().getTime();
}

/**
 * @param nBucketsConfigured number of buckets configured by the user (there is always one additional bucket)
 * @returns 
 */
export function generateBucketIndex(nBucketsConfigured: number): number {
  return Math.floor(Math.random()*nBucketsConfigured) + 1;
}

export function generateGameConfig(mint: PublicKey): GameConfig {
  const entryFeeDecimalTokens: number = Math.random() * 10 * Math.pow(10, MINT_DECIMALS);
  const spillRate: number = Math.ceil(Math.random() * 2 * Math.pow(10, MINT_DECIMALS));
  const nBuckets: number = Math.ceil(Math.random() * 5 + 1);
  const maxPlayers: number = Math.ceil(Math.random() * 1000 + 1);
  return {
    mint: mint,
    entryFeeDecimalTokens: new anchor.BN(entryFeeDecimalTokens),
    spillRateDecimalTokensPerSecondPerPlayer: new anchor.BN(spillRate),
    nBuckets: new anchor.BN(nBuckets),
    maxPlayers: new anchor.BN(maxPlayers)
  };
}


export async function getGame(gameAddress: PublicKey, program: anchor.Program<Equilibrate>): Promise<Game> {
  return (await program.account.game.fetch(gameAddress)) as Game;
}

export async function getPlayerState(playerStateAddress: PublicKey, program: anchor.Program<Equilibrate>): Promise<PlayerState> {
  return await program.account.playerState.fetch(playerStateAddress);
}