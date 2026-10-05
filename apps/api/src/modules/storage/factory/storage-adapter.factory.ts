import { assertNever } from "@workspace/shared";

import type { TypedConfigService } from "../../../config/typed-config.service";
import { FirebaseObjectStorageAdapter } from "../adapters/firebase/firebase-object-storage.adapter";
import { LocalObjectStorageAdapter } from "../adapters/local/local-object-storage.adapter";
import type { LocalTransferTokenService } from "../adapters/local/local-transfer-token.service";
import { createS3Client } from "../adapters/s3/s3-client.factory";
import { S3ObjectStorageAdapter, type S3PublicDeliverySettings } from "../adapters/s3/s3-object-storage.adapter";
import type { ObjectStorage } from "../domain/object-storage.port";
import type { PublicDelivery } from "../domain/public-delivery.port";

export type StorageAdapter = ObjectStorage & PublicDelivery;

/** The S3 public-delivery settings `checkStorageRules` guarantees whenever STORAGE_PROVIDER=s3. */
export function s3PublicDeliverySettings(config: TypedConfigService): S3PublicDeliverySettings {
	const cdnHost: string | null = config.storage.cloudfrontPublicDomain;
	if (cdnHost === null) {
		throw new Error("STORAGE_CLOUDFRONT_PUBLIC_DOMAIN is required when STORAGE_PROVIDER=s3 (checkStorageRules enforces this)");
	}
	return { publicContainer: config.storage.publicContainer, cdnHost };
}

export function createStorageAdapter(config: TypedConfigService, localTokens: LocalTransferTokenService): StorageAdapter {
	switch (config.storage.provider) {
		case "s3":
			return new S3ObjectStorageAdapter(createS3Client({ region: config.storage.awsRegion }), s3PublicDeliverySettings(config));
		case "firebase":
			return new FirebaseObjectStorageAdapter(config);
		case "local":
			return new LocalObjectStorageAdapter(config, localTokens);
		default:
			return assertNever(config.storage.provider, "storage provider");
	}
}
