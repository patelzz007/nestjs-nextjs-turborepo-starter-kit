interface RegistryHeld<K> {
	readonly key: K;
	readonly ref: WeakRef<object>;
}

/** Identity-checked delete used by the finalizer — exported for unit tests. */
export function finalizeWeakValueEntry<K, V extends object>(store: Map<K, WeakRef<V>>, held: RegistryHeld<K>): void {
	const current = store.get(held.key);
	if (current === held.ref) {
		store.delete(held.key);
	}
}

/**
 * Opportunistic object cache keyed strongly while values are held weakly.
 *
 * Overwrites unregister the previous `WeakRef` token before registering a
 * replacement so a stale finalizer cannot delete a live entry.
 */
export class WeakValueCache<K, V extends object> {
	private readonly _store = new Map<K, WeakRef<V>>();
	private readonly _registry = new FinalizationRegistry<RegistryHeld<K>>((held): void => {
		finalizeWeakValueEntry(this._store, held);
	});

	public get(key: K): V | undefined {
		const ref = this._store.get(key);
		if (ref === undefined) {
			return undefined;
		}
		const value = ref.deref();
		if (value === undefined) {
			this._store.delete(key);
			return undefined;
		}
		return value;
	}

	public set(key: K, value: V): void {
		const existing = this._store.get(key);
		if (existing !== undefined) {
			this._registry.unregister(existing);
		}

		const ref = new WeakRef(value);
		this._store.set(key, ref);
		this._registry.register(value, { key, ref }, ref);
	}

	public delete(key: K): boolean {
		const existing = this._store.get(key);
		if (existing === undefined) {
			return false;
		}
		this._registry.unregister(existing);
		this._store.delete(key);
		return true;
	}

	public clear(): void {
		for (const ref of this._store.values()) {
			this._registry.unregister(ref);
		}
		this._store.clear();
	}

	public get size(): number {
		return this._store.size;
	}
}
