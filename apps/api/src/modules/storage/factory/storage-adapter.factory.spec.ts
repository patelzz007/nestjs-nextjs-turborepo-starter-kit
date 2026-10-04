import { afterEach, describe, expect, it, vi } from "vitest";

import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { LocalObjectStorageAdapter } from "../adapters/local/local-object-storage.adapter";
import { LocalTransferTokenService } from "../adapters/local/local-transfer-token.service";
import { S3ObjectStorageAdapter } from "../adapters/s3/s3-object-storage.adapter";
import { createStorageAdapter, s3PublicDeliverySettings } from "./storage-adapter.factory";

const S3_ENV = {
	STORAGE_PROVIDER: "s3",
	STORAGE_PRIVATE_CONTAINER: "app-test-private",
	STORAGE_PUBLIC_CONTAINER: "app-test-public-origin",
	STORAGE_CLOUDFRONT_PUBLIC_DOMAIN: "d111111abcdef8.cloudfront.net",
	STORAGE_CLOUDFRONT_DISTRIBUTION_ID: "E2QWRUHAPOMQZL",
};

describe("createStorageAdapter", () => {
	afterEach((): void => {
		vi.unstubAllEnvs();
	});

	it("builds the S3 adapter with no AWS access keys configured (credentials come from the IAM role chain)", () => {
		vi.stubEnv("AWS_ACCESS_KEY_ID", undefined);
		vi.stubEnv("AWS_SECRET_ACCESS_KEY", undefined);

		expect(createStorageAdapter(createTestTypedConfig(S3_ENV), new LocalTransferTokenService())).toBeInstanceOf(S3ObjectStorageAdapter);
	});

	it("builds the local adapter for STORAGE_PROVIDER=local", () => {
		expect(createStorageAdapter(createTestTypedConfig({ STORAGE_PROVIDER: "local" }), new LocalTransferTokenService())).toBeInstanceOf(LocalObjectStorageAdapter);
	});
});

describe("s3PublicDeliverySettings", () => {
	it("delivers public assets from the public-origin bucket through the CloudFront host", () => {
		expect(s3PublicDeliverySettings(createTestTypedConfig(S3_ENV))).toEqual({ publicContainer: "app-test-public-origin", cdnHost: "d111111abcdef8.cloudfront.net" });
	});

	it("refuses a configuration without a CloudFront host", () => {
		expect(() => s3PublicDeliverySettings(createTestTypedConfig({ STORAGE_PROVIDER: "local" }))).toThrow(/STORAGE_CLOUDFRONT_PUBLIC_DOMAIN/);
	});
});
