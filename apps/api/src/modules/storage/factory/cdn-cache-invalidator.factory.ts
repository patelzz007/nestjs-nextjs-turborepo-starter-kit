import { assertNever } from "@workspace/shared";

import type { TypedConfigService } from "../../../config/typed-config.service";
import { NoCdnCacheInvalidator } from "../adapters/cdn/no-cdn-cache-invalidator";
import { CloudFrontCacheInvalidator, createCloudFrontClient } from "../adapters/s3/cloudfront-cache-invalidator";
import type { CdnCacheInvalidator } from "../domain/cdn-cache.port";

/** The CloudFront distribution `checkStorageRules` guarantees whenever STORAGE_PROVIDER=s3. */
export function cloudFrontDistributionId(config: TypedConfigService): string {
	const distributionId: string | null = config.cloudfrontDistributionId;
	if (distributionId === null) {
		throw new Error("STORAGE_CLOUDFRONT_DISTRIBUTION_ID is required when STORAGE_PROVIDER=s3 (checkStorageRules enforces this)");
	}
	return distributionId;
}

export function createCdnCacheInvalidator(config: TypedConfigService): CdnCacheInvalidator {
	switch (config.storageProvider) {
		case "s3":
			return new CloudFrontCacheInvalidator(createCloudFrontClient(), cloudFrontDistributionId(config));
		case "firebase":
		case "local":
			return new NoCdnCacheInvalidator();
		default:
			return assertNever(config.storageProvider, "storage provider");
	}
}
