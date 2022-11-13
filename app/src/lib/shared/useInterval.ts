import { useEffect, useState } from "react";

/**
 * Stateful hook equivalent of `setInterval`, automatically clears on unmount
 * and updates the callback when it changes.
 *
 * @param callback callback to call with interval
 * @param intervalMs (approximate) interval between calls in milliseconds
 */
export function useInterval(callback: () => void, intervalMs: number) {
    const [updateInterval, setUpdateIntervalObj] = useState<NodeJS.Timeout | undefined>();

    useEffect(() => {
        if (updateInterval) {
            clearInterval(updateInterval);
        }

        const newInterval: NodeJS.Timeout = setInterval(callback, intervalMs);
        setUpdateIntervalObj(newInterval);

        return () => {
            clearInterval(newInterval);
        };
    }, [ callback ]);
}
