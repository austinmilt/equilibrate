import { Duration } from "../shared/duration";

interface CacheValue<V> {
    valueIsNullish?: boolean;
    value?: V;
    promise?: Promise<V>;
    expiration?: Date;
}

export class SimpleCache<K, V> {
    private readonly ttl?: Duration;
    private readonly allowNullish: boolean;
    private readonly cache: Map<K, CacheValue<V>> = new Map<K, CacheValue<V>>();

    private constructor(allowNullish: boolean, ttl?: Duration) {
        this.ttl = ttl;
        this.allowNullish = allowNullish;
    }

    public static withTtl<Key, Value>(ttl: Duration, allowNullish: boolean = false): SimpleCache<Key, Value> {
        return new SimpleCache<Key, Value>(allowNullish, ttl);
    }


    public static withoutTtl<Key, Value>(allowNullish: boolean = false): SimpleCache<Key, Value> {
        return new SimpleCache<Key, Value>(allowNullish);
    }


    public async getOrFetch(key: K, fetcher: () => Promise<V>): Promise<V> {
        const cacheValue: CacheValue<V> | undefined = this.cache.get(key);
        let result: V;
        if (this.needToFetch(cacheValue)) {
            try {
                const promise: Promise<V> = fetcher();
                this.cache.set(key, {promise: promise});
                result = await promise;
                const expiration: Date | undefined = this.ttl?.fromNow();
                if ((result == null) && !this.allowNullish) {
                    throw new Error("Got nullish value for non-nullish cache.");
                }
                this.cache.set(key, {
                    promise: promise,
                    value: result == null ? undefined: result,
                    valueIsNullish: result == null,
                    expiration: expiration
                });
            } catch (e) {
                this.cache.delete(key);
                throw e;
            }
        } else if ((cacheValue?.value === undefined) && (cacheValue?.promise !== undefined)) {
            result = await cacheValue.promise;

        } else if (cacheValue?.value !== undefined) {
            result = cacheValue.value;

        } else if (cacheValue?.valueIsNullish && this.allowNullish) {
            result = null as V;

        } else {
            throw new Error("Cache is in bad state and unable to update. This is a bug.");
        }
        return result;
    }

    private needToFetch(cacheValue: CacheValue<V> | undefined): boolean {
        const expired: boolean = (cacheValue?.expiration !== undefined) &&
            (cacheValue.expiration.getTime() < new Date().getTime());

        const valueMissing: boolean = cacheValue?.value === undefined;

        const valueNotBeingFetched: boolean = cacheValue?.promise === undefined;

        return (valueMissing && valueNotBeingFetched) || expired;
    }
}
