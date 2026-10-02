import { describe, expect, it } from "vitest";

import { createTestTypedConfig } from "../../test/support/test-api-env";

describe("TypedConfigService", () => {
	it("exposes the validated config through the historical getter names", () => {
		const config = createTestTypedConfig({ THROTTLE_DEFAULT_LIMIT: "1000", EMAIL_REPLY_TO: "support@example.com" });

		expect(config.throttleDefaultLimit).toBe(1000);
		expect(config.emailReplyTo).toBe("support@example.com");
		expect(config.jwtAccessExpiry).toBe("15m");
		expect(config.appName).toBe("hello-world");
		expect(config.corsOrigins).toEqual(["http://localhost:3000", "http://localhost:3001", "http://localhost:3003"]);
		expect(config.nodeEnv).toBe("test");
		expect(config.isTest).toBe(true);
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
		expect(createTestTypedConfig({ NODE_ENV: "production", REDIS_URL: "redis://cache:6379" }).secureCookies).toBe(true);
	});

	it("turns Prisma debug logging on for LOG_LEVEL debug/trace only", () => {
		expect(createTestTypedConfig({ LOG_LEVEL: "debug" }).isDebugLogging).toBe(true);
		expect(createTestTypedConfig({ LOG_LEVEL: "trace" }).isDebugLogging).toBe(true);
		expect(createTestTypedConfig({ LOG_LEVEL: "info" }).isDebugLogging).toBe(false);
	});

	it("reports the storage provider switches consistently", () => {
		const s3 = createTestTypedConfig({ STORAGE_PROVIDER: "s3", STORAGE_S3_BUCKET: "bucket" });

		expect([s3.useS3Storage, s3.useFirebaseStorage, s3.useLocalStorage]).toEqual([true, false, false]);
		expect(s3.storageBucket).toBe("bucket");
		expect(createTestTypedConfig().useLocalStorage).toBe(true);
	});
});
