import { useCallback, useEffect, useState } from "react";
import { Duration } from "./duration";
import { useLocalStorageParam } from "./local-storage";
import { NATIVE_MINT } from "@solana/spl-token";
import { SOLANA_MINT_NAME } from "./constants";

const LOCAL_STORAGE_KEY: string = "mint-list";

export interface MintData {
    /**
     * Unique ID of this mint among all the mints.
     */
    id: string;

    /**
     * Friendly display name of the mint.
     */
    name: string;

    /**
     * Solana base58 address of the mint.
     */
    address: string;
}


interface UseMintListContext {
    /**
     * List of available mints. Will be `null` during initialization and if
     * we fail to retrieve the list.
     */
    mints: MintData[] | null;

    /**
     * Will be `true` during initialization/update of the list.
     */
    initialized: boolean;
}


/**
 * Hook to use the app's available mint list.
 *
 * @returns
 */
export function useMintList(): UseMintListContext {
    const localStorageContext = useLocalStorageParam<MintData[]>(LOCAL_STORAGE_KEY);

    return {
        mints: localStorageContext.value,
        initialized: localStorageContext.initialized
    };
}


/**
 * Checks that the mint list in local storage is current and updates it, if needed.
 *
 * @returns `true` when the mint list has been evaluated and (if needed) updated
 */
export function useLoadMintList(): boolean {
    const localStorageContext = useLocalStorageParam<MintData[]>(LOCAL_STORAGE_KEY);
    const [initialized, setInitialized] = useState<boolean>(false);

    const updateList: () => void = useCallback(async () => {
        setInitialized(false);
        try {
            const response: Response = await fetch(
                "https://api.coingecko.com/api/v3/coins/list?include_platform=true",
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
            if (response.ok && (response.status < 400)) {
                const rawData: CoinGeckoCoinListEntry[] = await response.json();
                const formattedData: MintData[] = rawData.flatMap(flatMapCoinGeckoEntry);
                localStorageContext.set(formattedData, Duration.ofDays(1).fromNow());

            } else {
                throw new Error(`Coingecko returned an error code ${response.status}`);
            }
        } catch (e) {
            console.error("Unable to fetch mint list.", e);
        }
        setInitialized(true);

    }, [setInitialized, localStorageContext.set]);


    // fetch the mint list and set it for the app to use
    useEffect(() => {
        if (localStorageContext.initialized && (localStorageContext.value === null)) {
            updateList();
        }
    }, [localStorageContext.initialized, localStorageContext.value]);

    return initialized;
}


interface CoinGeckoCoinListEntry {
    id: string;
    name: string;
    symbol: string;
    platforms: {[platform: string]: string};
}


const WRAPPED_SOL_ADDRESS: string = NATIVE_MINT.toBase58();

function flatMapCoinGeckoEntry(entry: CoinGeckoCoinListEntry): MintData | [] {
    for (const [platform, address] of Object.entries(entry.platforms)) {
        if (platform === "solana") {
            let entryName: string = entry.name;
            if (address === WRAPPED_SOL_ADDRESS) {
                entryName = SOLANA_MINT_NAME;
            }
            return {
                name: entryName,
                address: address,
                id: entry.id
            };
        }
    }
    return [];
}


