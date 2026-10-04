import type { CdnCacheInvalidator, CdnInvalidationRequest } from "../../domain/cdn-cache.port";

/**
 * Invalidator for providers that serve public assets without a CDN cache
 * (local: by file id through the API; Firebase: token URLs revoked at once).
 * Their withdrawals never report cached keys, so a request with keys means the
 * wiring is wrong — it fails loudly instead of pretending to purge.
 */
export class NoCdnCacheInvalidator implements CdnCacheInvalidator {
	public invalidate(request: CdnInvalidationRequest): Promise<void> {
		if (request.objectKeys.length === 0) {
			return Promise.resolve();
		}
		return Promise.reject(new Error(`No CDN is configured for this storage provider; cannot invalidate ${String(request.objectKeys.length)} key(s) (${request.reference})`));
	}
}
