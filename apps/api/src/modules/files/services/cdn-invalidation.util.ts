import { StorageCdnInvalidationJobSchema, type StorageCdnInvalidationJob } from "@workspace/shared";

import type { CdnInvalidationRequest } from "../../storage/domain/cdn-cache.port";

/**
 * The CDN purge for one withdrawn file. The reference is derived from the file
 * id only, so every retry of the same job is the same invalidation (CloudFront
 * CallerReference idempotency).
 */
export function toCdnInvalidationRequest(job: StorageCdnInvalidationJob): CdnInvalidationRequest {
	const parsed = StorageCdnInvalidationJobSchema.parse(job);
	return { reference: `file-${parsed.fileId}-withdrawal`, objectKeys: parsed.objectKeys };
}
