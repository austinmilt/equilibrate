// https://vitejs.dev/guide/env-and-mode.html

export const SOLANA_RPC_URL: string = parseEnv(import.meta.env.VITE_SOLANA_RPC_URL, "SOLANA_RPC_URL");

function parseEnv<T>(value: string | undefined, name: string, transform: (v: string) => T = castString): T {
    if (value === undefined) {
        throw new Error(`Missing required env variable ${name}.`);
    }
    return transform(value);
}


function castString<T>(value: string): T {
    return value as T;
}
