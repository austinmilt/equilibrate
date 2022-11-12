import { createContext, ReactNode, useCallback, useContext, useReducer, useMemo, useEffect, useState } from "react";

interface LocalStorageContextState {
    values: {[key: string]: string}
    set: (key: string, value: string) => void;
    remove: (key: string) => void;
    initialized: boolean;
}


const LocalStorageContext = createContext<LocalStorageContextState>(
    {} as LocalStorageContextState
);


function valuesReducer(
    values: {[key: string]: string},
    data: {action: "set" | "remove" | "clear", key?: string, value?: string | undefined}
): {[key: string]: string} {
    switch (data.action) {
    case "clear": return {};
    case "set": {
        if (data.key === undefined) {
            throw new Error("Tried to set a value without giving the key.");

        } else if (data.value == null) {
            throw new Error("Tried to set a value to nullish.");
        }
        values[data.key] = data.value;
        return values;
    }
    case "remove": {
        if (data.key === undefined) {
            throw new Error("Tried to remove a value without giving the key.");
        }
        delete values[data.key];
        return values;
    }
    default: throw new Error(`Unsupported action ${data.action}.`);
    }
}


export function LocalStorageProvider(props: { children: ReactNode }): JSX.Element {
    const [values, reducer] = useReducer(valuesReducer, {});
    const [initialized, setInitialized] = useState<boolean>(false);
    const [triggerUpdate, setTriggerUpdate] = useState<boolean>(false);

    const refresh: (key: string) => void = useCallback((key) => {
        const value: string | null = localStorage.getItem(key);
        if (value === null) {
            reducer({action: "remove", key: key});

        } else {
            reducer({action: "set", key: key, value: value});
        }
        // hack because `values` isnt triggering a re-render
        setTriggerUpdate(true);
    }, [reducer]);


    const set: (key: string, value: string) => void = useCallback((key, value) => {
        localStorage.setItem(key, value);
        refresh(key);
    }, [refresh]);


    const remove: (key: string) => void = useCallback((key) => {
        localStorage.removeItem(key);
        refresh(key);
    }, [refresh]);


    // initial load of everything
    useEffect(() => {
        for (let i = 0; i < localStorage.length; i++) {
            const key: string | null = localStorage.key(i);
            if (key !== null) {
                refresh(key);
            }
        }
        setInitialized(true);
    }, []);


    const state: LocalStorageContextState = useMemo(() => {
        setTriggerUpdate(false);
        return {
            values: values,
            set: set,
            remove: remove,
            initialized: initialized
        };
    }, [set, remove, initialized, triggerUpdate]);


    return (
        <LocalStorageContext.Provider value={state}>
            {props.children}
        </LocalStorageContext.Provider>
    );
}




interface UseLocalStorageParamContext<T> {
    /**
     * Value in local storage, if it exists (and hasnt expired), `null` otherwise. Automatically updated
     * after calling `set` or `remove`, and upon automatic expiration.
     */
    value: T | null

    /**
     * Sets the value in local storage. If you want to delete/remove the value, use
     * `remove` rather than trying to set the value to empty/null.
     *
     * @param value value to set in local storage
     * @param expiration date at which the value should automatically expire, default is no expiration.
     * The expiration is lazily enforced, such that the value may remain in local storage until this
     * hook is used.
     */
    set: (value: T, expiration?: Date) => void

    /**
     * Removes the value from local storage if it exists. Safe to call without knowing
     * if the value is already there.
     */
    remove: () => void

    intialized: boolean;
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
 * Hook to interact with local storage
 *
 * @param key key of the value to get/store in local storage
 * @returns hook with context for interacting with local storage
 */
export function useLocalStorageParam<T>(key: string, options?: Options<T>): UseLocalStorageParamContext<T> {
    const localStorageContext = useContext(LocalStorageContext);
    const [removeTimeoutId, setRemoveTimeoutId] = useState<NodeJS.Timeout | undefined>();

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
    }, [removeTimeoutId]);


    const value: T | null = useMemo(() => {
        let result: T | null = null;
        if (localStorageContext.initialized) {
            const wrappedValue: WrappedStorageValue<T> | null = parseWrappedLocalStorageValue(
                localStorageContext.values[key],
                deserialize
            );
            if (wrappedValue == null) {
                localStorageContext.remove(key);
                removeTimeoutIfNeeded();

            } else if (wrappedValue.expiration != null) {
                // set/update up automatic expiration
                removeTimeoutIfNeeded();
                const ttlMs: number = wrappedValue.expiration.getTime() - new Date().getTime();
                if (ttlMs > 0) {
                    const newTimeoutId: NodeJS.Timeout = setTimeout(() => { localStorage.removeItem(key); }, ttlMs);
                    setRemoveTimeoutId(newTimeoutId);
                }
            }

            result = wrappedValue?.value ?? null;
        }
        return result;

    }, [key, localStorageContext.values[key], deserialize]);


    const set: UseLocalStorageParamContext<T>["set"] = useCallback((value, expiration) => {
        const storageValue: WrappedStorageValueInternal = {
            stringValue: serialize(value),
            expirationEpochMs: expiration?.getTime()
        };
        localStorageContext.set(key, JSON.stringify(storageValue));
    }, [key, serialize, localStorageContext.set]);


    const remove = useCallback(() => {
        localStorageContext.remove(key);
    }, [key, localStorageContext.remove]);


    return {
        value: value,
        set: set,
        remove: remove,
        intialized: localStorageContext.initialized
    };
}

interface WrappedStorageValue<T> {
    value: T;
    expiration: Date | undefined;
    expired: boolean;
}


interface WrappedStorageValueInternal {
    stringValue: string
    expirationEpochMs: number | undefined | null
}


function parseWrappedLocalStorageValue<T>(
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
