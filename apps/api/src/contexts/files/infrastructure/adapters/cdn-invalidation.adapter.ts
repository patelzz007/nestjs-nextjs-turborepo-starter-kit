import { StorageCdnInvalidationJobSchema, type StorageCdnInvalidationJob } from "@workspace/shared";

import type { CdnCacheInvalidator, CdnInvalidationRequest } from "../../../../platform/infrastructure/storage/domain/cdn-cache.port";
import type { CdnInvalidationPort } from "../../application/ports/file-processing.port";

/**
 * The CDN purge for one withdrawn file. The reference is derived from the file
 * id only, so every retry of the same job is the same invalidation (CloudFront
 * CallerReference idempotency).
 */
export function toCdnInvalidationRequest(job: StorageCdnInvalidationJob): CdnInvalidationRequest {
	const parsed = StorageCdnInvalidationJobSchema.parse(job);
	return { reference: `file-${parsed.fileId}-withdrawal`, objectKeys: parsed.objectKeys };
}

/** {@link CdnInvalidationPort} over the platform CDN cache invalidator. */
export class CdnInvalidationAdapter implements CdnInvalidationPort {
	public constructor(private readonly cdnCache: CdnCacheInvalidator) {}

	public async invalidate(job: StorageCdnInvalidationJob): Promise<void> {
		await this.cdnCache.invalidate(toCdnInvalidationRequest(job));
	}
}
