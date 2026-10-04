// ============================================
// infrastructure/redis/redis-namespace.ts - the ONE place Redis names are built
// ============================================
// Every raw Redis key and pub/sub channel the API uses goes through this
// class, so two APIs sharing one Redis (a dev API and an e2e run, two
// deployments) with different REDIS_NAMESPACE values never read each other's
// keys or hear each other's messages. BullMQ keys are namespaced separately by
// BULLMQ_PREFIX. Obtain it from `TypedConfigService.redisNamespace`.

/** Separator between the namespace and the name (Redis convention). */
const NAMESPACE_SEPARATOR = ":";

export class RedisNamespace {
	public constructor(public readonly namespace: string) {}

	/** `<namespace>:<name>` — a key (e.g. `auth:me:<userId>`). */
	public key(name: string): string {
		return `${this.namespace}${NAMESPACE_SEPARATOR}${name}`;
	}

	/** `<namespace>:<name>` — a pub/sub channel (e.g. `authz:invalidate`). */
	public channel(name: string): string {
		return this.key(name);
	}

	/**
	 * A SCAN `MATCH` pattern for every key under `keyPrefix` in this namespace.
	 * The namespace charset (letters, digits, `:`, `_`, `-`) holds no glob
	 * metacharacters, so only `keyPrefix` is escaped.
	 */
	public scanPattern(keyPrefix: string): string {
		return `${this.key(keyPrefix.replace(/[*?[\]\\]/g, "\\$&"))}*`;
	}
}
