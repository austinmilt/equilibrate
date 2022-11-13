import { ScrollArea, Text, Anchor } from "@mantine/core";
import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useMemo } from "react";
import { SHIP_MAX_LOGS } from "../../../lib/shared/constants";
import { Duration } from "../../../lib/shared/duration";
import {
    parseWrappedLocalStorageValue,
    useLocalStorage,
    useLocalStorageParam
} from "../../../lib/shared/local-storage";
import styles from "./styles.module.css";

const LOGS_KEY_PREFIX: string = "ship-logs:";
const LOGS_KEY_DUMMY_SUFFIX: string = "dummy";

export function ShipLog(props: { gameAddress: PublicKey | undefined }): JSX.Element {
    const logsContext = useShipLogs(props.gameAddress);

    return <div className={styles["ship-log"]}>
        <ScrollArea>
            {
                logsContext.logs.map((log, i) =>
                    <LogEntryComponent log={log} key={i}/>
                )
            }
        </ScrollArea>
    </div>;
}


function LogEntryComponent(props: { log: LogEntry }): JSX.Element {
    return (
        <div>
            {
                props.log.url === undefined ?
                    <Text>{props.log.text}</Text> :
                    <Anchor href={props.log.url} target="_blank">{props.log.text}</Anchor>
            }
        </div>
    );
}


interface LogEntry {
    text: string;
    url?: string;
}


interface UseShipLogsContext {
    logs: LogEntry[];
    record: (log: LogEntry) => void;
    onEscapeSystem: () => void;
}


interface ShipLogsLocalStorageValue {
    stale: boolean;
    logs: LogEntry[];
}


export function useShipLogs(gameAddress: PublicKey | undefined): UseShipLogsContext {
    const key: string = useMemo(() =>
        `${LOGS_KEY_PREFIX}${gameAddress?.toBase58() ?? LOGS_KEY_DUMMY_SUFFIX}`,
    [gameAddress]);

    const localStorageContext = useLocalStorageParam<ShipLogsLocalStorageValue>(key);


    const logs: LogEntry[] = useMemo(() =>
        localStorageContext.value?.logs ?? [],
    [localStorageContext.value]);


    const stale: boolean = useMemo(() =>
        localStorageContext.value?.stale ?? false,
    [localStorageContext.value]);


    const record: UseShipLogsContext["record"] = useCallback((log) => {
        while (logs.length >= SHIP_MAX_LOGS) {
            logs.shift();
        }
        logs.push(log);
        // setting an expiration ensures that if the game somehow ends without the user
        // being actively participating or watching, it wont clog up their local storage
        localStorageContext.set({stale: stale, logs: logs}, Duration.ofDays(90).fromNow());
    }, [stale, logs, localStorageContext.set]);


    const onEscapeSystem: UseShipLogsContext["onEscapeSystem"] = useCallback(() => {
        localStorageContext.set({stale: true, logs: logs});
    }, [localStorageContext.set, logs]);


    return {
        logs: logs,
        record: record,
        onEscapeSystem: onEscapeSystem
    };
}


/**
 * Removes stale logs for old games the user has left.
 */
export function useCleanShipLogs(): void {
    const localStorageContext = useLocalStorage();

    useEffect(() => {
        for (const [key, value] of Object.entries(localStorageContext.values)) {
            if (key === `${LOGS_KEY_PREFIX}${LOGS_KEY_DUMMY_SUFFIX}`) {
                localStorageContext.remove(key);

            } else if (isLogsLocalStorageKey(key)) {
                const parsedValue = parseWrappedLocalStorageValue<ShipLogsLocalStorageValue>(value);
                const isStale: boolean = (parsedValue !== null) && (parsedValue.value.stale);
                if (isStale) {
                    localStorageContext.remove(key);
                }
            }
        }
    }, []);
}


function isLogsLocalStorageKey(candidate: string): boolean {
    if (candidate.startsWith(LOGS_KEY_PREFIX)) {
        const candidateGameAddressString: string = candidate.slice(LOGS_KEY_PREFIX.length);
        try {
            new PublicKey(candidateGameAddressString);
            return true;

        } catch (e) {
            // swallow, it's not a game log
        }
    }
    return false;
}
