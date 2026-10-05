import { describe, expect, it } from "vitest";

import { createTestTypedConfig } from "../../test/support/test-api-env";

describe("TypedConfigService", () => {
	it("exposes the validated config groups", () => {
		const config = createTestTypedConfig({ THROTTLE_DEFAULT_LIMIT: "1000", EMAIL_REPLY_TO: "support@example.com" });

		expect(config.rateLimits.throttleDefaultLimit).toBe(1000);
		expect(config.email.replyTo).toBe("support@example.com");
		expect(config.auth.jwtAccessExpiry).toBe("15m");
		expect(config.runtime.appName).toBe("hello-world");
		expect(config.http.corsOrigins).toEqual(["http://localhost:3000", "http://localhost:3001", "http://localhost:3003"]);
		expect(config.runtime.nodeEnv).toBe("test");
		expect(config.runtime.isTest).toBe(true);
	});

	it("resolves the frontend base URL per auth client type", () => {
		const config = createTestTypedConfig();

		expect(config.resolveClientAppUrl("admin")).toBe("http://localhost:3001");
		expect(config.resolveClientAppUrl("merchant")).toBe("http://localhost:3003");
		expect(config.resolveClientAppUrl("web")).toBe("http://localhost:3000");
		expect(config.resolveClientAppUrl(undefined)).toBe("http://localhost:3000");
	});

	it("returns a fresh copy of the tenant master key so callers cannot mutate the config", () => {
		const config = createTestTypedConfig();
		const key: Buffer = config.tenantEncryptionMasterKey;
		key.fill(0);

		expect(config.tenantEncryptionMasterKey.length).toBe(32);
		expect(config.tenantEncryptionMasterKey.equals(key)).toBe(false);
	});

	it("uses Redis-backed caches only when the backend resolves to redis AND Redis is configured", () => {
		expect(createTestTypedConfig({ REDIS_URL: "redis://cache:6379" }).useRedisAuthorizationCache).toBe(true);
		expect(createTestTypedConfig({ REDIS_URL: "redis://cache:6379", USER_SESSION_CACHE_BACKEND: "memory" }).useRedisUserSessionCache).toBe(false);
		expect(createTestTypedConfig().useRedisAuthorizationCache).toBe(false);
		expect(createTestTypedConfig({ AUTHORIZATION_CACHE_BACKEND: "redis" }).useRedisAuthorizationCache).toBe(false);
	});

	it("derives broker switches from the configured URLs", () => {
		const withBrokers = createTestTypedConfig({ REDIS_URL: "redis://cache:6379", KAFKA_BROKERS: "localhost:9092" });

		expect(withBrokers.useBullMq).toBe(true);
		expect(withBrokers.useKafka).toBe(true);
		expect(createTestTypedConfig().useBullMq).toBe(false);
		expect(createTestTypedConfig().useKafka).toBe(false);
	});

	it("marks auth cookies Secure only in production", () => {
		expect(createTestTypedConfig().secureCookies).toBe(false);
		expect(
			createTestTypedConfig({ NODE_ENV: "production", REDIS_URL: "redis://cache:6379", LOGIN_VERIFICATION_MODE: "new-device", TENANT_KMS_PROVIDER: "local" }).secureCookies,
		).toBe(true);
	});

	it("exposes the tenant KEK ring as decoded buffers and the KMS provider", () => {
		const retired = Buffer.alloc(32, 8);
		const config = createTestTypedConfig({
			TENANT_ENCRYPTION_MASTER_KEY_VERSION: "3",
			TENANT_ENCRYPTION_PREVIOUS_MASTER_KEYS: JSON.stringify({ 1: retired.toString("base64") }),
		});
		expect(config.encryption.tenantMasterKeyVersion).toBe(3);
		expect(config.tenantEncryptionPreviousMasterKeys.get(1)?.equals(retired)).toBe(true);
		expect(config.encryption.tenantKmsProvider).toBe("local");
	});

	it("turns Prisma debug logging on for LOG_LEVEL debug/trace only", () => {
		expect(createTestTypedConfig({ LOG_LEVEL: "debug" }).isDebugLogging).toBe(true);
		expect(createTestTypedConfig({ LOG_LEVEL: "trace" }).isDebugLogging).toBe(true);
		expect(createTestTypedConfig({ LOG_LEVEL: "info" }).isDebugLogging).toBe(false);
	});

	it("reports the storage provider switches consistently", () => {
		const s3 = createTestTypedConfig({
			STORAGE_PROVIDER: "s3",
			STORAGE_S3_BUCKET: "bucket",
			STORAGE_S3_PUBLIC_BUCKET: "public-origin-bucket",
			STORAGE_CLOUDFRONT_PUBLIC_DOMAIN: "d111111abcdef8.cloudfront.net",
			STORAGE_CLOUDFRONT_DISTRIBUTION_ID: "E2QWRUHAPOMQZL",
		});

		expect([s3.storage.provider, s3.useLocalStorage]).toEqual(["s3", false]);
		expect(s3.storage.privateContainer).toBe("bucket");
		expect(createTestTypedConfig().useLocalStorage).toBe(true);
	});
});
