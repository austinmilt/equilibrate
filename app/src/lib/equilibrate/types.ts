import * as anchor from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";

export interface GameEnriched extends Game {
    config: GameConfigEnriched;
    state: GameStateEnriched;
}


export interface GameWithEnrichedConfig extends Game {
    config: GameConfigEnriched;
}


export interface Game {
  config: GameConfig;
  state: GameState;
  id: anchor.BN;
  creator: PublicKey;
}


export interface GameConfigEnriched extends GameConfig {
    mintDecimals: number | null;
}


export interface GameConfig {
    mint: PublicKey;
    entryFeeDecimalTokens: anchor.BN;
    spillRateDecimalTokensPerSecondPerPlayer: anchor.BN;
    nBuckets: number;
    maxPlayers: number;
}


export interface GameStateEnriched extends GameState {
    buckets: BucketEnriched[];
}


export interface GameState {
    buckets: Bucket[];
    lastUpdateEpochSeconds: anchor.BN;
}


export interface BucketEnriched extends Bucket {
    netSpillRateDecimalTokensPerSecond: number;
}


export interface Bucket {
    decimalTokens: anchor.BN;
    players: number;
}


export interface PlayerState {
    bucket: number;
}


export interface PoolManager {
    bump: number;
}
