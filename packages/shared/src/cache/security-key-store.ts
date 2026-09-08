export interface SecurityKeyStoreOptions {
	/** Maximum distinct keys tracked in memory. */
	readonly maxKeys: number;
}

export interface SecurityKeyStoreDiagnostics {
	readonly keys: number;
	readonly maxKeys: number;
}

/**
 * Bounded key store for security counters and sliding windows.
 *
 * Expired keys are removed deterministically on access. When the store is at
 * capacity, **new** keys are rejected (fail-closed) so an attacker cannot evict
 * another principal's active limit window.
 */
export class SecurityKeyStore<K> {
	private readonly _maxKeys: number;
	private readonly _expiresAtByKey = new Map<K, number>();

	public constructor(options: SecurityKeyStoreOptions) {
		this._maxKeys = options.maxKeys;
	}

	/**
	 * Reserve a key slot or refresh its expiry.
	 *
	 * @returns `false` when the key is new and the store is at capacity.
	 */
	public reserveKey(key: K, expiresAt: number, now: number = Date.now()): boolean {
		this.sweepExpired(now);

		const existingExpiry = this._expiresAtByKey.get(key);
		if (existingExpiry !== undefined) {
			this._expiresAtByKey.set(key, expiresAt);
			return true;
		}

		if (this._expiresAtByKey.size >= this._maxKeys) {
			return false;
		}

		this._expiresAtByKey.set(key, expiresAt);
		return true;
	}

	public touchKey(key: K, expiresAt: number): void {
		this._expiresAtByKey.set(key, expiresAt);
	}

	public has(key: K, now: number = Date.now()): boolean {
		const expiresAt = this._expiresAtByKey.get(key);
		if (expiresAt === undefined) {
			return false;
		}
		if (now > expiresAt) {
			this._expiresAtByKey.delete(key);
			return false;
		}
		return true;
	}

	public delete(key: K): boolean {
		return this._expiresAtByKey.delete(key);
	}

	public clear(): void {
		this._expiresAtByKey.clear();
	}

	public sweepExpired(now: number = Date.now()): number {
		let removed = 0;
		for (const [key, expiresAt] of this._expiresAtByKey) {
			if (now > expiresAt) {
				this._expiresAtByKey.delete(key);
				removed += 1;
			}
		}
		return removed;
	}

	public get size(): number {
		return this._expiresAtByKey.size;
	}

	public getDiagnostics(): SecurityKeyStoreDiagnostics {
		return {
			keys: this._expiresAtByKey.size,
			maxKeys: this._maxKeys,
		};
	}
}
