import { GameConfig } from "./types";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";
import { MINT_DECIMALS } from "./token";

export const PROGRAM_FEE_DESTINATION: PublicKey = new PublicKey('GgPpTKg78vmzgDtP1DNn72CHAYjRdKY7AV6zgszoHCSa');
export const PROGRAM_FEE_LAMPORTS: number = 15000000;
export const MAX_GAME_BUCKETS: number = 64

export function generateGameId(): number {
  // All we need is to ensure that each game is unique,
  // and using the epoch time in milliseconds will with very high
  // likelihood produce this result, while also conveniently
  // making games sequentially ordered
  return new Date().getTime();
}

export function generateGameConfig(token: PublicKey): GameConfig {
  const entryFeeDecimalTokens: number = Math.random() * 10 * Math.pow(10, MINT_DECIMALS);
  const spillRate: number = Math.ceil(Math.random() * 2 * Math.pow(10, MINT_DECIMALS));
  const nBuckets: number = Math.ceil(Math.random() * 5 + 1);
  const maxPlayers: number = Math.ceil(Math.random() * 1000 + 1);
  return {
    token: token,
    entryFeeDecimalTokens: new anchor.BN(entryFeeDecimalTokens),
    spillRateDecimalTokensPerSecondPerPlayer: new anchor.BN(spillRate),
    nBuckets: new anchor.BN(nBuckets),
    maxPlayers: new anchor.BN(maxPlayers)
  };
}
