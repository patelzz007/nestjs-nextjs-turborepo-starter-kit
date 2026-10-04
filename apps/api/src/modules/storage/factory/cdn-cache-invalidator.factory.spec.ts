import { describe, expect, it } from "vitest";

import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { NoCdnCacheInvalidator } from "../adapters/cdn/no-cdn-cache-invalidator";
import { CloudFrontCacheInvalidator } from "../adapters/s3/cloudfront-cache-invalidator";
import { cloudFrontDistributionId, createCdnCacheInvalidator } from "./cdn-cache-invalidator.factory";

const S3_ENV = {
	STORAGE_PROVIDER: "s3",
	STORAGE_PRIVATE_CONTAINER: "app-test-private",
	STORAGE_PUBLIC_CONTAINER: "app-test-public-origin",
	STORAGE_CLOUDFRONT_PUBLIC_DOMAIN: "d111111abcdef8.cloudfront.net",
	STORAGE_CLOUDFRONT_DISTRIBUTION_ID: "E2QWRUHAPOMQZL",
};

describe("createCdnCacheInvalidator", () => {
	it("invalidates through CloudFront for S3", () => {
		expect(createCdnCacheInvalidator(createTestTypedConfig(S3_ENV))).toBeInstanceOf(CloudFrontCacheInvalidator);
		expect(cloudFrontDistributionId(createTestTypedConfig(S3_ENV))).toBe("E2QWRUHAPOMQZL");
	});

	it("has no CDN for local and firebase", () => {
		expect(createCdnCacheInvalidator(createTestTypedConfig({ STORAGE_PROVIDER: "local" }))).toBeInstanceOf(NoCdnCacheInvalidator);
		expect(createCdnCacheInvalidator(createTestTypedConfig({ STORAGE_PROVIDER: "firebase", FIREBASE_STORAGE_BUCKET: "app.appspot.com" }))).toBeInstanceOf(
			NoCdnCacheInvalidator,
		);
	});

	it("refuses a configuration without a distribution id", () => {
		expect(() => cloudFrontDistributionId(createTestTypedConfig({ STORAGE_PROVIDER: "local" }))).toThrow(/STORAGE_CLOUDFRONT_DISTRIBUTION_ID/);
	});
});

describe("NoCdnCacheInvalidator", () => {
	it("accepts an empty purge and fails loudly on keys it cannot purge", async () => {
		const none = new NoCdnCacheInvalidator();

		await expect(none.invalidate({ reference: "r", objectKeys: [] })).resolves.toBeUndefined();
		await expect(none.invalidate({ reference: "r", objectKeys: ["k"] })).rejects.toThrow(/No CDN/);
	});
});
