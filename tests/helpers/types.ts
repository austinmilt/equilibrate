import * as anchor from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";

export interface Game {
  config: GameConfig;
  state: GameState;
  id: anchor.BN;
  creator: PublicKey;
}

export interface GameConfig {
    mint: PublicKey;
    entryFeeDecimalTokens: anchor.BN;
    spillRateDecimalTokensPerSecondPerPlayer: anchor.BN;
    nBuckets: anchor.BN;
    maxPlayers: anchor.BN;
}

export interface GameState {
    buckets: Bucket[];
    lastUpdateEpochSeconds: anchor.BN;
}

export interface Bucket {
    decimalTokens: anchor.BN;
    players: number;
}


export interface PlayerState {
    bucket: anchor.BN;
}
