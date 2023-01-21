import { PublicKey } from "@solana/web3.js";
import * as anchor from "@project-serum/anchor";

export const GAME_SEED: string = "equilibrate-game";
export const PLAYER_SEED: string = "equilibrate-player";
export const POOL_SEED: string = "equilibrate-pool";
export const POOL_MANAGER_SEED: string = "equilibrate-pool-manager";
export const TOKEN_PROGRAM_ID: PublicKey = anchor.utils.token.TOKEN_PROGRAM_ID;
export const ASSOCIATED_TOKEN_PROGRAM_ID: PublicKey = anchor.utils.token.ASSOCIATED_PROGRAM_ID;
export const SYSTEM_PROGRAM_ID: PublicKey = anchor.web3.SystemProgram.programId;
export const RENT_SYSVAR: PublicKey = anchor.web3.SYSVAR_RENT_PUBKEY;
export const PROGRAM_FEE_DESTINATION: PublicKey = new PublicKey("EQui1fSdC2HetpETDAoaLaPYvYR7xVuXmLyUiiEvfA2h");
export const PROGRAM_ID: PublicKey = new PublicKey("BuckEtJp6Y7sv6nunxX6agCa64dX3LCqx1GTJgKcZoUe");
export const GAME_BUCKETS_MIN: number = 2;
export const GAME_BUCKETS_MAX: number = 64;
export const ENTRY_FEE_MIN_EXCLUSIVE: number = 0;
export const SPILL_RATE_MIN_EXCLUSIVE: number = 0;
export const BURN_RATE_MIN: number = 0;
export const GAME_MAX_PLAYERS_MAX: number = 10000;
export const GAME_MAX_PLAYERS_MIN: number = 2;
export const PLAYER_BUCKET_INDEX_MIN: number = 1;
export const PROGRAM_ERROR_ABORT_LEAVE_ON_LOSS: string = "AbortLeaveOnLoss";
export const ACCOUNTS_VERSION: number = 1; // needs to match what's in the program constants
