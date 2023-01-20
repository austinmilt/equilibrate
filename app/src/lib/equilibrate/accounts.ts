import { Game, GameConfig, PlayerState, PoolManager } from "./types";
import * as anchor from "@project-serum/anchor";

export function mapGameAccountToCurrentVersion(account: {[key: string]: unknown}): Game {
    return {
        version: getAttribute(account, "version", 0),
        id: getAttribute(account, "id"),
        creator: getAttribute(account, "creator"),
        config: mapGameConfigToCurrentVersion(account.config as {[key: string]: unknown}),
        state: getAttribute(account, "state")
    };
}


function mapGameConfigToCurrentVersion(config: {[key: string]: unknown}): GameConfig {
    return {
        mint: getAttribute(config, "mint"),
        entryFeeDecimalTokens: getAttribute(config, "entryFeeDecimalTokens"),
        spillRateDecimalTokensPerSecondPerPlayer: getAttribute(config, "spillRateDecimalTokensPerSecondPerPlayer"),
        nBuckets: getAttribute(config, "nBuckets"),
        maxPlayers: getAttribute(config, "maxPlayers"),
        burnRateDecimalTokensPerMove: getAttribute(config, "burnRateDecimalTokensPerMove", new anchor.BN(0)),
    };
}


export function mapPlayerStateToCurrentVersion(account: {[key: string]: unknown}): PlayerState {
    return {
        version: getAttribute(account, "version", 0),
        bucket: getAttribute(account, "bucket"),
        burnPenaltyDecimalTokens: getAttribute(account, "burnPenaltyDecimalTokens", new anchor.BN(0)),
    };
}


export function mapPoolManagerToCurrentVersion(account: {[key: string]: unknown}): PoolManager {
    return {
        version: getAttribute(account, "version", 0),
        bump: getAttribute(account, "bump"),
    };
}


function getAttribute<T>(account: {[key: string]: unknown}, key: string, fallbackValue?: T): T {
    const candidate: unknown | undefined = account[key];
    if ((candidate === undefined) && (fallbackValue === undefined)) {
        throw new Error(`Account is missing required attribute ${key}`);
    }
    return candidate as T;
}
