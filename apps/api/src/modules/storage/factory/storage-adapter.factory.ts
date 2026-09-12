import type { TypedConfigService } from "../../../config/typed-config.service";
import { FirebaseObjectStorageAdapter } from "../adapters/firebase/firebase-object-storage.adapter";
import { LocalObjectStorageAdapter } from "../adapters/local/local-object-storage.adapter";
import { S3ObjectStorageAdapter } from "../adapters/s3/s3-object-storage.adapter";
import type { ObjectStorage } from "../domain/object-storage.port";
import type { PublicDelivery } from "../domain/public-delivery.port";

export type StorageAdapter = ObjectStorage & PublicDelivery;

export function createStorageAdapter(config: TypedConfigService): StorageAdapter {
	if (config.storageProvider === "s3") {
		return new S3ObjectStorageAdapter(config);
	}
	if (config.storageProvider === "firebase") {
		return new FirebaseObjectStorageAdapter(config);
	}
	return new LocalObjectStorageAdapter(config);
}
