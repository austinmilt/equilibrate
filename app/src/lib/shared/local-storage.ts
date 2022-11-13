import { useCallback, useMemo, useEffect, useState } from "react";

interface UseLocalStorageContext {
    values: {[key: string]: string}
    set: (key: string, value: string) => void;
    remove: (key: string) => void;
    initialized: boolean;
}


/**
 * Hook to get live updates from local storage.
 *
 * @returns
 */
export function useLocalStorage() {
    const [values, setValues] = useState<UseLocalStorageContext["values"]>({});
    const [initialized, setInitialized] = useState<UseLocalStorageContext["initialized"]>(false);

    // initial load
    useEffect(() => {
        const newValues: {[key: string]: string} = {};
        if (typeof window !== "undefined") {
            for (let i = 0; i < localStorage.length; i++) {
                const key: string | null = localStorage.key(i);
                if (key !== null) {
                    setOrDeleteKeyValue(key, localStorage.getItem(key), newValues);
                }
            }
        }
        setValues(newValues);
        setInitialized(true);
    }, []);


    const updateValueIfNeeded = useCallback((event: StorageEvent) => {
        // key will be null when local storage was cleared
        if (event.key == null) {
            setValues({});

        } else if (event.newValue !== event.oldValue) {
            setOrDeleteKeyValue(event.key, event.newValue, values);
            setValues(values);
        }
    }, []);


    const mutations = useMutateLocalStorageWithEvent(updateValueIfNeeded);

    return {
        values: values,
        set: mutations.set,
        remove: mutations.remove,
        initialized: initialized
    };
}


function setOrDeleteKeyValue(key: string, value: string | null, values: {[key: string]: string}): void {
    if (value === null) {
        delete values[key];

    } else {
        values[key] = value;
    }
}


interface UseLocalStorageParamContext<T> {
    /**
     * Value in local storage, if it exists (and hasnt expired), `null` otherwise. Automatically updated
     * after calling `set` or `remove`, and upon automatic expiration.
     */
    value: T | null;

    /**
     * Sets the value in local storage. If you want to delete/remove the value, use
     * `remove` rather than trying to set the value to empty/null.
     *
     * @param value value to set in local storage
     * @param expiration date at which the value should automatically expire, default is no expiration.
     * The expiration is lazily enforced, such that the value may remain in local storage until this
     * hook is used.
     */
    set: (value: T, expiration?: Date) => void;

    /**
     * Removes the value from local storage if it exists. Safe to call without knowing
     * if the value is already there.
     */
    remove: () => void;

    initialized: boolean;
}


interface Options<T> {
    /**
     * serializer for storing the value, defaults to `JSON.stringify`
     * @param value
     * @returns
     */
    serialize?: (value: T) => string;

    /**
     * deserializer for retrieving the value, defaults to `JSON.parse`
     * @param valueString
     * @returns
     */
    deserialize?: (valueString: string) => T;
}


/**
 * Hook to interact with a single local storage param
 *
 * @param key key of the value to get/store in local storage
 * @returns hook with context for interacting with local storage
 */
export function useLocalStorageParam<T>(key: string, options?: Options<T>): UseLocalStorageParamContext<T> {
    const [value, setValue] = useState<T | null>(null);
    const [removeTimeoutId, setRemoveTimeoutId] = useState<NodeJS.Timeout | undefined>();
    const [initialized, setInitialized] = useState<boolean>(false);

    const serialize: Options<T>["serialize"] = useMemo(() =>
        options?.serialize ?? JSON.stringify,
    [options?.serialize]);


    const deserialize: Options<T>["deserialize"] = useMemo(() =>
        options?.deserialize ?? JSON.parse,
    [options?.deserialize]);


    const removeTimeoutIfNeeded: () => void = useCallback(() => {
        if (removeTimeoutId !== undefined) {
            clearTimeout(removeTimeoutId);
            setRemoveTimeoutId(undefined);
        }
    }, [removeTimeoutId, clearTimeout, setRemoveTimeoutId]);


    const processStorageValue: (key: string, value: string | null) => void = useCallback((key, value) => {
        const wrappedValue: WrappedStorageValue<T> | null = parseWrappedLocalStorageValue(value, deserialize);
        setValue(wrappedValue?.value ?? null);
        if (wrappedValue == null) {
            localStorage.removeItem(key);
            removeTimeoutIfNeeded();

        } else if (wrappedValue.expiration != null) {
            // set/update up automatic expiration
            removeTimeoutIfNeeded();
            const ttlMs: number = wrappedValue.expiration.getTime() - new Date().getTime();
            // Cant have a timeout longer than ~24 days 🤯
            // https://developer.mozilla.org/en-US/docs/Web/API/setTimeout#maximum_delay_value
            if ((ttlMs > 0) && (ttlMs < 2147483647)) {
                const newTimeoutId: NodeJS.Timeout = setTimeout(() => localStorage.removeItem(key), ttlMs);
                setRemoveTimeoutId(newTimeoutId);
            }
        }
    }, [setValue, removeTimeoutIfNeeded, setRemoveTimeoutId]);


    useEffect(() => {
        return () => removeTimeoutIfNeeded();
    }, []);


    // initial load
    useEffect(() => {
        if (typeof window !== "undefined") {
            processStorageValue(key, localStorage.getItem(key));
            setInitialized(true);
        }
    }, [key, window]);


    const updateValueIfNeeded = useCallback((event: StorageEvent) => {
        // key will be null when local storage was cleared
        if (event.key == null) {
            setValue(null);

        } else if ((event.key === key) && (event.newValue !== event.oldValue)) {
            processStorageValue(event.key, event.newValue);
        }
    }, [processStorageValue, setValue, key]);

    const mutations = useMutateLocalStorageWithEvent(updateValueIfNeeded);


    const set: UseLocalStorageParamContext<T>["set"] = useCallback((value, expiration) => {
        const storageValue: WrappedStorageValueInternal = {
            expirationEpochMs: expiration?.getTime(),
            stringValue: serialize(value)
        };
        mutations.set(key, JSON.stringify(storageValue));
    }, [key, serialize, mutations.set]);


    const remove: UseLocalStorageParamContext<T>["remove"] = useCallback(() => {
        mutations.remove(key);
    }, [key, mutations.remove]);


    return {
        value: value,
        set: set,
        remove: remove,
        initialized: initialized
    };
}

export interface WrappedStorageValue<T> {
    value: T;
    expiration: Date | undefined;
    expired: boolean;
}


interface WrappedStorageValueInternal {
    stringValue: string
    expirationEpochMs: number | undefined | null
}


export function parseWrappedLocalStorageValue<T>(
    stringWrappedValue: string | null,
    deserialize: (valueString: string) => T = JSON.parse
): WrappedStorageValue<T> | null {
    let value: T | null = null;
    let expiration: Date | undefined;
    let expired: boolean = false;
    if (stringWrappedValue != null) {
        const wrappedValue: WrappedStorageValueInternal = JSON.parse(stringWrappedValue);
        value = deserialize(wrappedValue.stringValue);
        if (wrappedValue.expirationEpochMs != null) {
            const expirationEpochMs: number = wrappedValue.expirationEpochMs;
            expiration = new Date(expirationEpochMs);
            expired = expirationEpochMs < new Date().getTime();
        }
    }

    return (value === null) ? null : {
        value: value,
        expiration: expiration,
        expired: expired
    };
}


interface UseMutateLocalStorageWithEventContext {
    set: (key: string, value: string) => void;
    remove: (key: string) => void;
    clear: () => void;
}


class StorageEvents {
    public static set(key: string, value: string): StorageEvent {
        const oldValue: string | null = localStorage.getItem(key);
        return StorageEvents.make(key, value, oldValue);
    }


    public static remove(key: string): StorageEvent {
        const oldValue: string | null = localStorage.getItem(key);
        return StorageEvents.make(key, null, oldValue);
    }


    public static clear(): StorageEvent {
        return StorageEvents.make(null, null, null);
    }


    private static make(key: string | null, newValue: string | null, oldValue: string | null): StorageEvent {
        return new StorageEvent("storage", { key: key, newValue: newValue, oldValue: oldValue });
    }
}


function useMutateLocalStorageWithEvent(callback: (context: StorageEvent) => void) {
    const ready: boolean = useMemo(() => typeof window !== "undefined", [window]);

    const set: UseMutateLocalStorageWithEventContext["set"] = useCallback((key, value) => {
        if (ready) {
            dispatchEvent(StorageEvents.set(key, value));
            localStorage.setItem(key, value);
        }
    }, [ready]);

    const remove: UseMutateLocalStorageWithEventContext["remove"] = useCallback((key) => {
        if (ready) {
            dispatchEvent(StorageEvents.remove(key));
            localStorage.removeItem(key);
        }
    }, [ready]);

    const clear: UseMutateLocalStorageWithEventContext["clear"] = useCallback(() => {
        if (ready) {
            dispatchEvent(StorageEvents.clear());
            localStorage.clear();
        }
    }, [ready]);


    useEffect(() => {
        addEventListener("storage", callback);

        return () => {
            removeEventListener("storage", callback);
        };
    }, [callback]);


    return {
        set: set,
        remove: remove,
        clear: clear
    };
}
