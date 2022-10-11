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
export const PROGRAM_FEE_LAMPORTS: number = 15000000;
export const MAX_GAME_BUCKETS: number = 64;
