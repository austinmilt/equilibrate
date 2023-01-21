// https://vitejs.dev/guide/env-and-mode.html

import { PublicKey, clusterApiUrl } from "@solana/web3.js";
import { Endpoint } from "../solana/provider";
import { Duration } from "./duration";
import { NATIVE_MINT } from "@solana/spl-token";

export const SOLANA_MINT_NAME: string = "SOL";

export const GAMES_LIST_UPDATE_INTERVAL: Duration = parseEnv(
    "GAMES_LIST_UPDATE_INTERVAL",
    import.meta.env.VITE_GAMES_LIST_UPDATE_INTERVAL,
    Duration.ofMinutes(1),
    (v) => Duration.ofSeconds(Number.parseInt(v))
);


export const VIEWPORT_UPDATE_INTERVAL_MS: Duration = parseEnv(
    "VIEWPORT_UPDATE_INTERVAL_MS",
    import.meta.env.VITE_GAMES_LIST_UPDATE_INTERVAL,
    Duration.ofMilliseconds(100),
    (v) => Duration.ofMilliseconds(Number.parseInt(v))
);


export const SHIP_MAX_LOGS: number = parseEnv(
    "SHIP_MAX_LOGS",
    import.meta.env.VITE_SHIP_MAX_LOGS,
    20,
    Number.parseInt
);


export const RPC_URL_LOCAL: string = parseEnv(
    "RPC_URL_LOCAL",
    import.meta.env.VITE_RPC_URL_LOCAL,
    "http://localhost:8899"
);


export const RPC_URL_DEV: string = parseEnv(
    "RPC_URL_DEV",
    import.meta.env.VITE_RPC_URL_DEV,
    clusterApiUrl("devnet")
);


export const RPC_URL_MAIN: string = parseEnv(
    "RPC_URL_MAIN",
    import.meta.env.VITE_RPC_URL_MAIN,
    clusterApiUrl("mainnet-beta")
);


export const RPC_KEY_DEFAULT: Endpoint = parseEnv(
    "RPC_KEY_DEFAULT",
    import.meta.env.VITE_RPC_KEY_DEFAULT,
    "dev",
    v => v as Endpoint
);


export const USE_BORING_THEME: boolean = parseEnv<boolean>(
    "USE_BORING_THEME",
    import.meta.env.VITE_USE_BORING_THEME,
    true,
    v => v.toLowerCase() === "true"
);


export const NEW_GAME_DEFAULT_MINT: PublicKey = parseEnv<PublicKey>(
    "NEW_GAME_DEFAULT_MINT",
    import.meta.env.VITE_NEW_GAME_DEFAULT_MINT,
    NATIVE_MINT,
    v => new PublicKey(v)
);


export const DEBUG: boolean = parseBoolean(
    "DEBUG",
    import.meta.env.VITE_DEBUG,
    false
);


function parseBoolean(name: string, value: string | undefined, defaultValue?: boolean): boolean {
    return parseEnv(name, value, defaultValue, v => {
        const lowercase: string = v.toLowerCase().trim();
        if ((lowercase === "true") || (lowercase === "1")) return true;
        else if ((lowercase === "false") || (lowercase === "0")) return false;
        else throw new Error(`Invalid boolean string ${value}`);
    });
}


function parseEnv<T>(
    name: string,
    value: string | undefined,
    defaultValue?: T | undefined,
    transform: (v: string) => T = castString
): T {
    let result: T;
    if (value === undefined) {
        if (defaultValue === undefined) {
            throw new Error(`Missing required env variable ${name}.`);

        } else {
            result = defaultValue;
        }
    } else {
        result = transform(value);
    }
    return result;
}


function castString<T>(value: string): T {
    return value as T;
}
