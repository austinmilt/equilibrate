import { ScrollArea, Text, Anchor } from "@mantine/core";
import { PublicKey } from "@solana/web3.js";
import { useCallback, useEffect, useMemo } from "react";
import { SHIP_MAX_LOGS } from "../../../lib/shared/constants";
import { Duration } from "../../../lib/shared/duration";
import { useLocalStorageParam } from "../../shared/localStorage/provider";
import styles from "./styles.module.css";

const LOGS_KEY_PREFIX: string = "ship-logs:";
const LOGS_KEY_DUMMY_SUFFIX: string = "dummy";

export function ShipLog(props: { gameAddress: PublicKey | undefined }): JSX.Element {
    const logsContext = useShipLogs(props.gameAddress);

    return <ScrollArea className={styles["ship-log"]}>
        {
            logsContext.logs.map((log, i) =>
                <LogEntryComponent log={log} key={i}/>
            )
        }
    </ScrollArea>;
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
    const localStorageContext = useLocalStorageParam<ShipLogsLocalStorageValue>(
        `${LOGS_KEY_PREFIX}${gameAddress?.toBase58() ?? LOGS_KEY_DUMMY_SUFFIX}`
    );


    // remove dummy logs that might have gotten created along the way
    // ... would be better to avoid ever making these, though
    useEffect(() => {
        return () => {
            localStorage.removeItem(`${LOGS_KEY_PREFIX}${LOGS_KEY_DUMMY_SUFFIX}`);
        };
    }, []);


    const logs: LogEntry[] = useMemo(() =>
        localStorageContext.value?.logs ?? [],
    [localStorageContext.value?.logs]);


    const stale: boolean = useMemo(() =>
        localStorageContext.value?.stale ?? false,
    [localStorageContext.value?.stale]);


    const record: UseShipLogsContext["record"] = useCallback((log) => {
        while (logs.length >= SHIP_MAX_LOGS) {
            logs.shift();
        }
        logs.push(log);
        // setting an expiration ensures that if the game somehow ends without the user
        // being actively participating or watching, it wont clog up their local storage
        localStorageContext.set({stale: stale, logs: logs}, Duration.ofDays(90).fromNow());
    }, [stale, logs]);


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
export function cleanShipLogs(): void {
    for (let i = 0; i < localStorage.length; i++) {
        const key: string | null = localStorage.key(i);
        if ((key !== null) && isLogsLocalStorageKey(key)) {
            const stringValue: string | null = localStorage.getItem(key);
            if (stringValue !== null) {
                const value: ShipLogsLocalStorageValue = JSON.parse(stringValue);
                if (value.stale) {
                    localStorage.removeItem(key);
                }
            }
        }
    }
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
