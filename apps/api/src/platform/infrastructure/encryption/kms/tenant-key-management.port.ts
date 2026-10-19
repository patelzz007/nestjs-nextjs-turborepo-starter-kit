/**
 * Key-management port for tenant envelope encryption: a provider wraps and
 * unwraps organization data keys (DEKs) with a key-encryption key (KEK) it
 * holds. The service never sees KEK material — only the provider's key id,
 * which is stored with every wrapped DEK so a later KEK rotation can still
 * unwrap it and `rewrap` can move it to the current KEK.
 */
export interface WrappedDataKey {
	/** Provider key id of the KEK that wrapped this DEK (e.g. `local-dev-kek/v2`). */
	readonly kmsKeyId: string;
	/** Provider-specific serialized ciphertext of the DEK. */
	readonly wrappedKey: string;
}

export interface TenantKeyManagementPort {
	/** Key id new DEKs are wrapped with. */
	currentKeyId(): string;
	wrapDataKey(dataKey: Buffer): Promise<WrappedDataKey>;
	/** Throws when the KEK is unavailable or the wrapped key does not authenticate. */
	unwrapDataKey(wrapped: WrappedDataKey): Promise<Buffer>;
}

/** Nest injection token of the configured {@link TenantKeyManagementPort}. */
export const TENANT_KEY_MANAGEMENT: unique symbol = Symbol("TENANT_KEY_MANAGEMENT");

/** The KEK a wrapped key names is not configured (retired and removed before re-wrap, or an unknown provider id). */
export class TenantKekUnavailableError extends Error {
	public constructor(public readonly kmsKeyId: string) {
		super(`Tenant key-encryption key ${kmsKeyId} is not available to this provider`);
		this.name = "TenantKekUnavailableError";
	}
}
