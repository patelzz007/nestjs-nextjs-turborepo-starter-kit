/** One CDN cache purge: the object keys to drop, under a caller reference that makes retries idempotent. */
export interface CdnInvalidationRequest {
	/** Stable per logical purge (e.g. per withdrawn file): a retried request is recognised, not repeated. */
	readonly reference: string;
	readonly objectKeys: readonly string[];
}

/**
 * Purges object keys from the CDN that serves public assets. Implementations
 * throw when the CDN did not accept the purge; callers run it from a retried
 * background job, never inside a user request.
 */
export interface CdnCacheInvalidator {
	invalidate(request: CdnInvalidationRequest): Promise<void>;
}
