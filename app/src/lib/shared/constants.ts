// https://vitejs.dev/guide/env-and-mode.html

import { Duration } from "./duration";

export const GAMES_LIST_UPDATE_INTERVAL: Duration = parseEnv(
    "GAMES_LIST_UPDATE_INTERVAL",
    import.meta.env.VITE_GAMES_LIST_UPDATE_INTERVAL,
    Duration.ofSeconds(10),
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
