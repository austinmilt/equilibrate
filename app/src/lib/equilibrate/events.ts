export interface EventCallback<T> {
    (event: T): void;
}

export class EventEmitter<T> {
    private readonly listeners: Set<EventCallback<T>> = new Set<EventCallback<T>>();

    /**
     * Subscribe to this event emitter with a new callback.
     *
     * @param callback callback to call when the event is emitted.
     * @returns another callback to unsubscribe
     */
    public subscribe(callback: EventCallback<T>): () => void {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }


    /**
     * Removes all registered listeners.
     */
    public unsubscribeAll(): void {
        this.listeners.clear();
    }


    /**
     * Emits a new event to all subscribers.
     *
     * @param event event to emit
     */
    public emit(event: T): void {
        this.listeners.forEach(callback => callback(event));
    }
}
