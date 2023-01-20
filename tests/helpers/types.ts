import * as anchor from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";

export interface Game {
    version: number;
    id: anchor.BN;
    creator: PublicKey;
    config: GameConfig;
    state: GameState;
}

export interface GameConfig {
    mint: PublicKey;
    entryFeeDecimalTokens: anchor.BN;
    spillRateDecimalTokensPerSecondPerPlayer: anchor.BN;
    nBuckets: number;
    maxPlayers: number;
    burnRateDecimalTokensPerMove: anchor.BN;
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
    version: number;
    bucket: number;
    burnPenaltyDecimalTokens: anchor.BN;
}


export interface PoolManager {
    version: number;
    bump: number;
}
