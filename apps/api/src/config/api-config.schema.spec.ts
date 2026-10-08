import { LIST_SLOT_INDEX, EnvValidationError } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { SINGLE_TENANT_SEED_ORGANIZATION_ID } from "../../prisma/seed/organization-seed-ids";
import { TEST_API_ENV, type TestEnv } from "../../test/support/test-api-env";
import { API_ENV_SCOPE, parseApiConfig } from "./api-config";
import { isLoopbackUrl, resolveApiDocsPolicy, resolveCacheBackend, resolveLogLevel, resolveRedisNamespace, type ApiConfig } from "./api-config.schema";

/** Parse the fixture with `overrides`; `undefined` removes a variable. */
function parse(overrides: Readonly<Record<string, string | undefined>> = {}): ApiConfig {
	return parseApiConfig({ ...TEST_API_ENV, ...overrides });
}

function captureEnvError(overrides: Readonly<Record<string, string | undefined>>): EnvValidationError {
	try {
		parse(overrides);
	} catch (error) {
		if (error instanceof EnvValidationError) {
			return error;
		}
		throw error;
	}
	throw new Error("expected an EnvValidationError");
}

/** Every variable the API cannot boot without (no defaults of any kind). */
const REQUIRED_VARIABLES: readonly string[] = [
	"NODE_ENV",
	"APP_NAME",
	"CORS_ORIGINS",
	"APP_URL",
	"ADMIN_APP_URL",
	"MERCHANT_APP_URL",
	"DATABASE_URL",
	"JWT_ACCESS_SECRET",
	"JWT_REFRESH_SECRET",
	"EMAIL_VERIFICATION_SECRET",
	"TWO_FACTOR_PENDING_SECRET",
	"MFA_ENCRYPTION_KEYS",
	"TENANT_ENCRYPTION_MASTER_KEY",
	"EMAIL_FROM_ADDRESS",
];

/** A valid production build running on localhost (the fixture's APP_URL). */
const PRODUCTION: TestEnv = { NODE_ENV: "production", REDIS_URL: "redis://cache.internal:6379", LOGIN_VERIFICATION_MODE: "new-device", TENANT_KMS_PROVIDER: "local" };

/** A valid DEPLOYED production environment: real host, real email delivery with a verifiable webhook. */
const DEPLOYED_PRODUCTION: TestEnv = {
	...PRODUCTION,
	APP_URL: "https://app.example.com",
	EMAIL_MODE: "send",
	RESEND_API_KEY: "re_test_only_key",
	RESEND_WEBHOOK_SECRET: "whsec_test_only_secret",
	STORAGE_PROVIDER: "s3",
	STORAGE_PRIVATE_CONTAINER: "app-private-bucket",
	STORAGE_PUBLIC_CONTAINER: "app-public-origin-bucket",
	STORAGE_CLOUDFRONT_PUBLIC_DOMAIN: "d111111abcdef8.cloudfront.net",
	STORAGE_CLOUDFRONT_DISTRIBUTION_ID: "E2QWRUHAPOMQZL",
	MALWARE_SCANNER: "none",
};

/** The S3 public-delivery pair (CloudFront origin bucket + CDN host) every s3 deployment needs. */
const S3_PUBLIC_DELIVERY: TestEnv = {
	STORAGE_PUBLIC_CONTAINER: "app-public-origin-bucket",
	STORAGE_CLOUDFRONT_PUBLIC_DOMAIN: "d111111abcdef8.cloudfront.net",
	STORAGE_CLOUDFRONT_DISTRIBUTION_ID: "E2QWRUHAPOMQZL",
};

describe("API env schema", () => {
	it("parses the TEST-ONLY fixture into the grouped config", () => {
		const config = parse();

		expect(config.runtime).toEqual({ nodeEnv: "test", isProduction: false, isDevelopment: false, isTest: true, appName: "hello-world" });
		expect(config.http.corsOrigins).toEqual(["http://localhost:3000", "http://localhost:3001", "http://localhost:3003"]);
		expect(config.clientApps).toEqual({ webUrl: "http://localhost:3000", adminUrl: "http://localhost:3001", merchantUrl: "http://localhost:3003" });
		expect(config.auth.bcryptSaltRounds).toBe(10);
		expect(config.email.mode).toBe("noop");
	});

	it("applies the documented defaults for optional tuning variables", () => {
		const config = parse();

		expect(config.http).toMatchObject({ host: "127.0.0.1", port: 8080, publicUrl: "http://127.0.0.1:8080", trustedProxies: [], shutdownTimeoutMs: 15_000 });
		expect(config.database).toMatchObject({ poolMax: 10, idleTimeoutMs: 30_000, allowExitOnIdle: true });
		expect(config.auth).toMatchObject({ jwtAccessExpiry: "15m", jwtRefreshExpiry: "7d", twoFactorIssuer: "hello-world", loginVerificationMode: "disabled" });
		expect(config.rateLimits).toEqual({ throttleDefaultLimit: 300, throttleStrictLimit: 30, throttleTtlMs: 60_000, securityCounterMaxKeys: 50_000 });
		expect(config.observability).toEqual({
			logLevel: "warn",
			memoryMonitoring: false,
			memoryLeakDetection: { warmupMs: 300_000, windowMs: 1_800_000, growthThresholdMb: 64 },
			observe: null,
		});
		expect(config.tenancy).toEqual({ enabled: false, singleTenantOrganizationId: SINGLE_TENANT_SEED_ORGANIZATION_ID });
		expect(config.encryption.tenantJobHmacSecret).toBeNull();
		expect(config.storage).toMatchObject({
			provider: "local",
			privateContainer: "local-private-bucket",
			publicContainer: "local-public-bucket",
			downloadTtlSeconds: 300,
			physicalDeleteDelayMs: 3_600_000,
		});
	});

	it("lists EVERY missing required variable by name in one error", () => {
		const unset: Record<string, undefined> = Object.fromEntries(REQUIRED_VARIABLES.map((name: string): [string, undefined] => [name, undefined]));
		const error = captureEnvError(unset);

		expect(error.scope).toBe(API_ENV_SCOPE);
		expect([...error.variables].sort()).toEqual([...REQUIRED_VARIABLES].sort());
		expect(error.message).toContain("JWT_ACCESS_SECRET: is required but not set");
	});

	it("treats an empty value like an unset one (FOO= in .env)", () => {
		expect(captureEnvError({ JWT_ACCESS_SECRET: "" }).issues).toEqual([{ variable: "JWT_ACCESS_SECRET", problem: "is required but not set" }]);
	});

	describe("secrets", () => {
		it("has no insecure defaults: every signing secret is required", () => {
			for (const name of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "EMAIL_VERIFICATION_SECRET", "TWO_FACTOR_PENDING_SECRET"]) {
				expect(captureEnvError({ [name]: undefined }).variables).toEqual([name]);
			}
		});

		it("rejects short secrets without printing them", () => {
			const short = "short-secret-value";
			const error = captureEnvError({ JWT_ACCESS_SECRET: short });

			expect(error.issues[LIST_SLOT_INDEX.first]?.problem).toMatch(/at least 32 characters/);
			expect(error.message).not.toContain(short);
		});

		it("rejects the .env.example placeholder even though it is long enough", () => {
			const error = captureEnvError({ JWT_REFRESH_SECRET: "change-me-run-pnpm-secrets-generate" });

			expect(error.issues[LIST_SLOT_INDEX.first]?.problem).toMatch(/placeholder/);
		});

		it("requires the four signing secrets to differ", () => {
			const reused = TEST_API_ENV.JWT_ACCESS_SECRET;
			const error = captureEnvError({ JWT_REFRESH_SECRET: reused, TWO_FACTOR_PENDING_SECRET: reused });

			expect(error.issues).toEqual([
				{ variable: "JWT_REFRESH_SECRET", problem: "must differ from JWT_ACCESS_SECRET" },
				{ variable: "TWO_FACTOR_PENDING_SECRET", problem: "must differ from JWT_ACCESS_SECRET" },
			]);
			expect(error.message).not.toContain(reused);
		});

		it("validates the optional job and processing-callback secrets when set", () => {
			expect(captureEnvError({ TENANT_JOB_HMAC_SECRET: "too-short" }).variables).toEqual(["TENANT_JOB_HMAC_SECRET"]);
			expect(captureEnvError({ STORAGE_PROCESSING_CALLBACK_SECRET: "too-short" }).variables).toEqual(["STORAGE_PROCESSING_CALLBACK_SECRET"]);
		});
	});

	describe("MFA_ENCRYPTION_KEYS", () => {
		const KEY_32_BYTES = Buffer.alloc(32, 2).toString("base64");

		it("maps positive key versions to base64 AES-256 key material", () => {
			const config = parse({ MFA_ENCRYPTION_KEYS: JSON.stringify({ 1: KEY_32_BYTES, 2: Buffer.alloc(32, 3).toString("base64") }) });

			expect(Object.keys(config.mfa.encryptionKeys)).toEqual(["1", "2"]);
			expect(config.mfa.encryptionKeys[LIST_SLOT_INDEX.third]).toBe(Buffer.alloc(32, 3).toString("base64"));
		});

		it("rejects non-JSON, an empty ring, bad versions and keys that are not 32 bytes — without printing the key", () => {
			const wrongLength = Buffer.alloc(128, 4).toString("base64");

			expect(captureEnvError({ MFA_ENCRYPTION_KEYS: "not json" }).issues[LIST_SLOT_INDEX.first]?.problem).toMatch(/JSON object/);
			expect(captureEnvError({ MFA_ENCRYPTION_KEYS: "{}" }).issues[LIST_SLOT_INDEX.first]?.problem).toMatch(/at least one key version/);
			expect(captureEnvError({ MFA_ENCRYPTION_KEYS: JSON.stringify({ zero: KEY_32_BYTES }) }).variables).toEqual(["MFA_ENCRYPTION_KEYS.zero"]);
			const lengthError = captureEnvError({ MFA_ENCRYPTION_KEYS: JSON.stringify({ 1: wrongLength }) });
			expect(lengthError.issues).toEqual([{ variable: "MFA_ENCRYPTION_KEYS.1", problem: "must decode to exactly 32 bytes (generate with: openssl rand -base64 32)" }]);
			expect(lengthError.message).not.toContain(wrongLength);
		});
	});

	describe("DEFAULT_ORGANIZATION_ID", () => {
		it("is required in single-tenant mode and must be an organization uuid — there is no placeholder default", () => {
			expect(captureEnvError({ DEFAULT_ORGANIZATION_ID: undefined }).variables).toEqual(["DEFAULT_ORGANIZATION_ID"]);
			expect(captureEnvError({ DEFAULT_ORGANIZATION_ID: "default" }).variables).toEqual(["DEFAULT_ORGANIZATION_ID"]);
		});

		it("is not needed in multi-tenant mode, which has no fallback organization", () => {
			expect(parse({ TENANCY_ENABLED: "true", DEFAULT_ORGANIZATION_ID: undefined }).tenancy).toEqual({ enabled: true });
		});
	});

	describe("tenant key-encryption key ring and KMS provider", () => {
		const RETIRED_KEY = Buffer.alloc(32, 6).toString("base64");

		it("defaults to KEK version 1, no retired keys and the local provider outside production", () => {
			expect(parse().encryption).toMatchObject({ tenantMasterKeyVersion: 1, tenantPreviousMasterKeys: {}, tenantKmsProvider: "local" });
		});

		it("requires TENANT_KMS_PROVIDER to be set explicitly in production — never an implicit local provider", () => {
			expect(captureEnvError({ ...PRODUCTION, TENANT_KMS_PROVIDER: undefined }).variables).toEqual(["TENANT_KMS_PROVIDER"]);
			expect(parse(PRODUCTION).encryption.tenantKmsProvider).toBe("local");
			expect(captureEnvError({ TENANT_KMS_PROVIDER: "aws-kms" }).variables).toEqual(["TENANT_KMS_PROVIDER"]);
		});

		it("parses retired key versions below the current version", () => {
			const config = parse({ TENANT_ENCRYPTION_MASTER_KEY_VERSION: "2", TENANT_ENCRYPTION_PREVIOUS_MASTER_KEYS: JSON.stringify({ 1: RETIRED_KEY }) });
			expect(config.encryption.tenantMasterKeyVersion).toBe(2);
			expect(config.encryption.tenantPreviousMasterKeys).toEqual({ 1: RETIRED_KEY });
		});

		it("rejects a retired key whose version is not below the current one, without echoing the key", () => {
			const error = captureEnvError({ TENANT_ENCRYPTION_MASTER_KEY_VERSION: "2", TENANT_ENCRYPTION_PREVIOUS_MASTER_KEYS: JSON.stringify({ 2: RETIRED_KEY }) });
			expect(error.variables).toEqual(["TENANT_ENCRYPTION_PREVIOUS_MASTER_KEYS"]);
			expect(error.message).not.toContain(RETIRED_KEY);
		});
	});

	describe("TENANT_ENCRYPTION_MASTER_KEY", () => {
		it("is required in every environment — there is no fallback key", () => {
			for (const nodeEnv of ["development", "test", "production"]) {
				expect(captureEnvError({ ...PRODUCTION, NODE_ENV: nodeEnv, TENANT_ENCRYPTION_MASTER_KEY: undefined }).variables).toContain("TENANT_ENCRYPTION_MASTER_KEY");
			}
		});

		it("must be base64 of exactly 32 bytes, and the error never echoes the value", () => {
			const notBase64 = "definitely not base64 !!";
			const sixteenBytes = Buffer.alloc(16, 9).toString("base64");

			const formatError = captureEnvError({ TENANT_ENCRYPTION_MASTER_KEY: notBase64 });
			expect(formatError.issues[LIST_SLOT_INDEX.first]?.problem).toMatch(/standard base64/);
			expect(formatError.message).not.toContain(notBase64);
			expect(captureEnvError({ TENANT_ENCRYPTION_MASTER_KEY: sixteenBytes }).issues[LIST_SLOT_INDEX.first]?.problem).toMatch(/exactly 32 bytes/);
		});
	});

	describe("formats", () => {
		it("rejects an unknown NODE_ENV instead of silently running with development defaults", () => {
			expect(captureEnvError({ NODE_ENV: "prod" }).variables).toEqual(["NODE_ENV"]);
		});

		it("requires absolute http(s) frontend URLs and origins", () => {
			expect(captureEnvError({ APP_URL: "localhost:3000" }).variables).toEqual(["APP_URL"]);
			expect(captureEnvError({ CORS_ORIGINS: "http://localhost:3000,not-an-origin" }).variables).toEqual(["CORS_ORIGINS.1"]);
		});

		it("requires a postgres DATABASE_URL and never prints its credentials", () => {
			const mysql = "mysql://root:hunter2hunter2@db/app";
			const error = captureEnvError({ DATABASE_URL: mysql });

			expect(error.variables).toEqual(["DATABASE_URL"]);
			expect(error.message).not.toContain("hunter2hunter2");
		});

		it("rejects out-of-range and non-integer tuning values instead of falling back", () => {
			expect(captureEnvError({ PORT: "70000" }).variables).toEqual(["PORT"]);
			expect(captureEnvError({ BCRYPT_SALT_ROUNDS: "4" }).variables).toEqual(["BCRYPT_SALT_ROUNDS"]);
			expect(captureEnvError({ THROTTLE_TTL_MS: "999" }).variables).toEqual(["THROTTLE_TTL_MS"]);
			expect(captureEnvError({ EMAIL_MAX_ATTEMPTS: "11" }).variables).toEqual(["EMAIL_MAX_ATTEMPTS"]);
			expect(captureEnvError({ DB_POOL_MAX: "ten" }).variables).toEqual(["DB_POOL_MAX"]);
		});

		it("validates closed option sets", () => {
			expect(captureEnvError({ EMAIL_MODE: "smtp" }).variables).toEqual(["EMAIL_MODE"]);
			expect(captureEnvError({ LOG_LEVEL: "verbose" }).variables).toEqual(["LOG_LEVEL"]);
			expect(captureEnvError({ AUTHORIZATION_CACHE_BACKEND: "memcached" }).variables).toEqual(["AUTHORIZATION_CACHE_BACKEND"]);
			expect(captureEnvError({ STORAGE_PROVIDER: "azure" }).variables).toEqual(["STORAGE_PROVIDER"]);
			expect(captureEnvError({ STORAGE_CLOUDFRONT_PUBLIC_DOMAIN: "https://d111111abcdef8.cloudfront.net" }).variables).toEqual(["STORAGE_CLOUDFRONT_PUBLIC_DOMAIN"]);
			expect(captureEnvError({ STORAGE_CLOUDFRONT_PUBLIC_DOMAIN: "d111111abcdef8.cloudfront.net/assets" }).variables).toEqual(["STORAGE_CLOUDFRONT_PUBLIC_DOMAIN"]);
			expect(parse({ STORAGE_CLOUDFRONT_PUBLIC_DOMAIN: "CDN.Example.com" }).storage.cloudfrontPublicDomain).toBe("cdn.example.com");
			expect(captureEnvError({ STORAGE_CLOUDFRONT_DISTRIBUTION_ID: "arn:aws:cloudfront::123456789012:distribution/E2QWRUHAPOMQZL" }).variables).toEqual([
				"STORAGE_CLOUDFRONT_DISTRIBUTION_ID",
			]);
			expect(captureEnvError({ STORAGE_CLOUDFRONT_DISTRIBUTION_ID: "e2qwruhapomqzl" }).variables).toEqual(["STORAGE_CLOUDFRONT_DISTRIBUTION_ID"]);
			expect(captureEnvError({ JWT_ACCESS_EXPIRY: "15 minutes" }).variables).toEqual(["JWT_ACCESS_EXPIRY"]);
		});

		it("trusts no proxy by default and accepts only an explicit list of trusted proxies", () => {
			expect(parse({}).http.trustedProxies).toEqual([]);
			expect(parse({ TRUST_PROXY: "0" }).http.trustedProxies).toEqual([]);
			expect(parse({ TRUST_PROXY: " 10.0.0.0/8 , loopback,203.0.113.7 " }).http.trustedProxies).toEqual(["10.0.0.0/8", "loopback", "203.0.113.7"]);
			expect(captureEnvError({ TRUST_PROXY: "1" }).variables).toEqual(["TRUST_PROXY"]);
			expect(captureEnvError({ TRUST_PROXY: "true" }).variables).toEqual(["TRUST_PROXY"]);
			expect(captureEnvError({ TRUST_PROXY: "10.0.0.0/99" }).variables).toEqual(["TRUST_PROXY"]);
			expect(captureEnvError({ TRUST_PROXY: "not-an-ip" }).variables).toEqual(["TRUST_PROXY"]);
		});

		it("accepts the 0/1/true/false toggle spellings and rejects anything else", () => {
			expect(captureEnvError({ SWAGGER_ENABLED: "yes" }).issues).toEqual([{ variable: "SWAGGER_ENABLED", problem: "must be one of 0, 1, false, true" }]);
		});

		it("requires true/false (not 0/1) for the boolean feature flags", () => {
			expect(parse({ TENANCY_ENABLED: "true" }).tenancy.enabled).toBe(true);
			expect(captureEnvError({ TENANCY_ENABLED: "1" }).variables).toEqual(["TENANCY_ENABLED"]);
		});

		it("defaults LOGIN_VERIFICATION_MODE to new-device and rejects unknown modes", () => {
			expect(parse({ LOGIN_VERIFICATION_MODE: undefined }).auth.loginVerificationMode).toBe("new-device");
			expect(parse({ LOGIN_VERIFICATION_MODE: "always" }).auth.loginVerificationMode).toBe("always");
			expect(captureEnvError({ LOGIN_VERIFICATION_MODE: "true" }).variables).toEqual(["LOGIN_VERIFICATION_MODE"]);
		});

		it("parses Kafka brokers, Redis and AMQP URLs", () => {
			const config = parse({ KAFKA_BROKERS: "k1:9092, k2:9093", REDIS_URL: "rediss://cache:6380", RABBITMQ_URL: "amqp://mq:5672" });

			expect(config.messaging).toMatchObject({ kafkaBrokers: ["k1:9092", "k2:9093"], redisUrl: "rediss://cache:6380", rabbitmqUrl: "amqp://mq:5672" });
			expect(captureEnvError({ KAFKA_BROKERS: "k1" }).variables).toEqual(["KAFKA_BROKERS.0"]);
			expect(captureEnvError({ REDIS_URL: "http://cache:6379" }).variables).toEqual(["REDIS_URL"]);
		});
	});

	describe("cross-field rules", () => {
		it("rejects local disk storage on a deployed production environment, but allows it on localhost", () => {
			expect(captureEnvError({ ...DEPLOYED_PRODUCTION, STORAGE_PROVIDER: "local" }).variables).toEqual(["STORAGE_PROVIDER"]);
			expect(captureEnvError({ ...DEPLOYED_PRODUCTION, STORAGE_PROVIDER: undefined, STORAGE_PRIVATE_CONTAINER: undefined }).variables).toEqual(["STORAGE_PROVIDER"]);
			expect(parse({ ...PRODUCTION, APP_URL: "http://localhost:3000", STORAGE_PROVIDER: "local" }).storage.provider).toBe("local");
		});

		it("resolves MALWARE_SCANNER=none to the explicit no-scanner mode (allowed everywhere, never CLEAN)", () => {
			expect(parse(DEPLOYED_PRODUCTION).storage.malwareScanner).toEqual({ kind: "none" });
			expect(captureEnvError({ MALWARE_SCANNER: "clamav" }).variables).toEqual(["MALWARE_SCANNER"]);
		});

		it("has no default scanner: MALWARE_SCANNER must be chosen explicitly", () => {
			expect(captureEnvError({ MALWARE_SCANNER: undefined }).variables).toEqual(["MALWARE_SCANNER"]);
		});

		it("requires RESEND_API_KEY when EMAIL_MODE=send, but not for log-only / noop", () => {
			expect(captureEnvError({ EMAIL_MODE: "send", RESEND_API_KEY: undefined }).issues).toEqual([
				{ variable: "RESEND_API_KEY", problem: "is required when EMAIL_MODE=send (set EMAIL_MODE=log-only or noop to run without Resend)" },
			]);
			expect(parse({ EMAIL_MODE: "log-only", RESEND_API_KEY: undefined }).email.resendApiKey).toBeNull();
		});

		it("forbids EMAIL_TEST_TO on a deployed production environment and requires REDIS_URL in production", () => {
			expect(captureEnvError({ ...DEPLOYED_PRODUCTION, REDIS_URL: undefined, EMAIL_TEST_TO: "dev@example.com" }).variables).toEqual(["EMAIL_TEST_TO", "REDIS_URL"]);
			expect(captureEnvError({ ...PRODUCTION, REDIS_URL: undefined }).variables).toEqual(["REDIS_URL"]);
			expect(parse(DEPLOYED_PRODUCTION).runtime.isProduction).toBe(true);
			expect(parse(PRODUCTION).runtime.isProduction).toBe(true);
			expect(parse({ EMAIL_TEST_TO: "dev@example.com" }).email.testTo).toBe("dev@example.com");
		});

		it("allows EMAIL_TEST_TO for a production build running on localhost", () => {
			const local = parse({ ...PRODUCTION, APP_URL: "http://localhost:3000", EMAIL_TEST_TO: "dev@example.com" });
			expect(local.runtime.isProduction).toBe(true);
			expect(local.email.testTo).toBe("dev@example.com");
			expect(parse({ ...PRODUCTION, APP_URL: "http://127.0.0.1:3000", EMAIL_TEST_TO: "dev@example.com" }).email.testTo).toBe("dev@example.com");
		});

		it("forbids log-only and noop email on a deployed production environment", () => {
			expect(captureEnvError({ ...DEPLOYED_PRODUCTION, EMAIL_MODE: "log-only" }).variables).toEqual(["EMAIL_MODE"]);
			expect(captureEnvError({ ...DEPLOYED_PRODUCTION, EMAIL_MODE: "noop" }).variables).toEqual(["EMAIL_MODE"]);
			// A production build on localhost may still print emails instead of sending them.
			expect(parse({ ...PRODUCTION, EMAIL_MODE: "log-only" }).email.mode).toBe("log-only");
		});

		it("requires RESEND_WEBHOOK_SECRET on a deployed production environment that sends email", () => {
			expect(captureEnvError({ ...DEPLOYED_PRODUCTION, RESEND_WEBHOOK_SECRET: undefined }).variables).toEqual(["RESEND_WEBHOOK_SECRET"]);
			expect(parse(DEPLOYED_PRODUCTION).email.resendWebhookSecret).toBe("whsec_test_only_secret");
		});

		it("rejects LOGIN_VERIFICATION_MODE=disabled in production, in every other environment it is allowed", () => {
			expect(captureEnvError({ ...PRODUCTION, LOGIN_VERIFICATION_MODE: "disabled" }).variables).toEqual(["LOGIN_VERIFICATION_MODE"]);
			expect(parse({ LOGIN_VERIFICATION_MODE: "disabled" }).auth.loginVerificationMode).toBe("disabled");
		});

		it("requires both halves of the AWS key pair for local development", () => {
			expect(captureEnvError({ AWS_ACCESS_KEY_ID: "AKIATESTONLY" }).variables).toEqual(["AWS_SECRET_ACCESS_KEY"]);
			expect(captureEnvError({ AWS_SECRET_ACCESS_KEY: "test-only-secret" }).variables).toEqual(["AWS_ACCESS_KEY_ID"]);
		});

		it("rejects static AWS access keys on a deployed production environment (IAM role only)", () => {
			const error = captureEnvError({ ...DEPLOYED_PRODUCTION, AWS_ACCESS_KEY_ID: "AKIATESTONLY", AWS_SECRET_ACCESS_KEY: "test-only-secret" });

			expect(error.variables).toEqual(["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]);
			expect(error.message).toContain("IAM role");
			expect(captureEnvError({ ...DEPLOYED_PRODUCTION, AWS_SECRET_ACCESS_KEY: "test-only-secret" }).variables).toEqual(["AWS_SECRET_ACCESS_KEY"]);
		});

		it("allows static AWS access keys only off a deployed environment (development, or a production build on localhost)", () => {
			const keys: TestEnv = { AWS_ACCESS_KEY_ID: "AKIATESTONLY", AWS_SECRET_ACCESS_KEY: "test-only-secret" };

			expect(parse(keys).storage.provider).toBe("local");
			expect(parse({ ...DEPLOYED_PRODUCTION, ...keys, APP_URL: "http://localhost:3000" }).storage.provider).toBe("s3");
		});

		it("boots S3 on a deployed production environment with no AWS keys at all (default credential chain)", () => {
			expect(parse(DEPLOYED_PRODUCTION).storage).toMatchObject({ provider: "s3", awsRegion: "ap-southeast-1" });
			expect(parse(DEPLOYED_PRODUCTION).storage).not.toHaveProperty("awsAccessKeyId");
		});

		it("requires the CloudFront origin bucket and CDN host for S3 public delivery", () => {
			expect(captureEnvError({ ...DEPLOYED_PRODUCTION, STORAGE_PUBLIC_CONTAINER: undefined }).variables).toEqual(["STORAGE_PUBLIC_CONTAINER"]);
			expect(captureEnvError({ ...DEPLOYED_PRODUCTION, STORAGE_CLOUDFRONT_PUBLIC_DOMAIN: undefined }).variables).toEqual(["STORAGE_CLOUDFRONT_PUBLIC_DOMAIN"]);
			expect(captureEnvError({ ...DEPLOYED_PRODUCTION, STORAGE_CLOUDFRONT_DISTRIBUTION_ID: undefined }).variables).toEqual(["STORAGE_CLOUDFRONT_DISTRIBUTION_ID"]);
			expect(parse(DEPLOYED_PRODUCTION).storage.cloudfrontDistributionId).toBe("E2QWRUHAPOMQZL");
			expect(captureEnvError({ ...DEPLOYED_PRODUCTION, STORAGE_PUBLIC_CONTAINER: "app-private-bucket" }).variables).toEqual(["STORAGE_PUBLIC_CONTAINER"]);
			expect(parse({ ...DEPLOYED_PRODUCTION, STORAGE_PUBLIC_CONTAINER: undefined, STORAGE_S3_PUBLIC_BUCKET: "legacy-public" }).storage.publicContainer).toBe("legacy-public");
		});

		it("needs no public bucket or CDN for the local and firebase providers", () => {
			expect(parse({ STORAGE_PROVIDER: "firebase", FIREBASE_STORAGE_BUCKET: "app.appspot.com" }).storage.cloudfrontPublicDomain).toBeNull();
			expect(parse({ STORAGE_PROVIDER: "local" }).storage.publicContainer).toBe("local-public-bucket");
		});

		it("requires Observe credentials when OBSERVE_ENABLED is on, and enables Observe only with them", () => {
			expect(captureEnvError({ OBSERVE_ENABLED: "1", OBSERVE_APP_KEY: "key" }).variables).toEqual(["OBSERVE_APP_SECRET"]);
			expect(parse({ OBSERVE_ENABLED: "1", OBSERVE_APP_KEY: "key", OBSERVE_APP_SECRET: "secret" }).observability.observe).toEqual({
				appKey: "key",
				appSecret: "secret",
				serviceId: "freebuff-api",
			});
			expect(parse({ ...PRODUCTION, OBSERVE_APP_KEY: "key" }).observability.observe).toBeNull();
		});

		it("requires a private container for the s3 and firebase providers", () => {
			expect(captureEnvError({ STORAGE_PROVIDER: "s3", ...S3_PUBLIC_DELIVERY }).variables).toEqual(["STORAGE_PRIVATE_CONTAINER"]);
			expect(captureEnvError({ STORAGE_PROVIDER: "firebase" }).variables).toEqual(["STORAGE_PRIVATE_CONTAINER"]);
			expect(parse({ STORAGE_PROVIDER: "firebase", FIREBASE_STORAGE_BUCKET: "app.appspot.com" }).storage.privateContainer).toBe("app.appspot.com");
		});
	});

	describe("derived values", () => {
		it("auto-detects s3 from a legacy bucket name, but never from a local-* container", () => {
			expect(parse({ STORAGE_S3_BUCKET: "rewardhub", ...S3_PUBLIC_DELIVERY }).storage).toMatchObject({ provider: "s3", privateContainer: "rewardhub" });
			expect(parse({ STORAGE_S3_BUCKET: "local-dev" }).storage.provider).toBe("local");
		});

		it("prefers the neutral container names over the legacy aliases", () => {
			const storage = parse({
				STORAGE_PRIVATE_CONTAINER: "neutral",
				STORAGE_S3_BUCKET: "legacy",
				STORAGE_PUBLIC_CONTAINER: "public",
				STORAGE_S3_PUBLIC_BUCKET: "legacy-public",
				STORAGE_CLOUDFRONT_PUBLIC_DOMAIN: "d111111abcdef8.cloudfront.net",
				STORAGE_CLOUDFRONT_DISTRIBUTION_ID: "E2QWRUHAPOMQZL",
			}).storage;

			expect(storage.privateContainer).toBe("neutral");
			expect(storage.publicContainer).toBe("public");
		});

		it("honours the legacy download TTL alias and the production delete delay", () => {
			expect(parse({ KYB_DOCUMENT_DOWNLOAD_TTL_SECONDS: "120" }).storage.downloadTtlSeconds).toBe(120);
			expect(parse({ STORAGE_DOWNLOAD_TTL_SECONDS: "60", KYB_DOCUMENT_DOWNLOAD_TTL_SECONDS: "120" }).storage.downloadTtlSeconds).toBe(60);
			expect(parse(PRODUCTION).storage.physicalDeleteDelayMs).toBe(2_592_000_000);
		});

		it("turns on security hardening and memory monitoring in production, and never lets the pool exit on idle there", () => {
			const production = parse(PRODUCTION);

			expect(production.http.securityHardeningEnabled).toBe(true);
			expect(production.observability.memoryMonitoring).toBe(true);
			expect(production.database.allowExitOnIdle).toBe(false);
			expect(parse({ ...PRODUCTION, SECURITY_HARDENING_ENABLED: "0" }).http.securityHardeningEnabled).toBe(false);
			expect(parse({ SECURITY_HARDENING_ENABLED: "1" }).http.securityHardeningEnabled).toBe(true);
		});

		it("uses API_PUBLIC_URL when set, trimming the trailing slash", () => {
			expect(parse({ API_PUBLIC_URL: "https://api.example.com/" }).http.publicUrl).toBe("https://api.example.com");
		});
	});
});

describe("resolveApiDocsPolicy", () => {
	it("is on and public by default outside production", () => {
		expect(resolveApiDocsPolicy(undefined, false)).toEqual({ enabled: true, access: "public" });
		expect(resolveApiDocsPolicy(false, false)).toEqual({ enabled: false, access: "public" });
	});

	it("is OFF by default in production, and SuperAdmin-only when explicitly enabled there", () => {
		expect(resolveApiDocsPolicy(undefined, true)).toEqual({ enabled: false, access: "platform_admin" });
		expect(resolveApiDocsPolicy(true, true)).toEqual({ enabled: true, access: "platform_admin" });
	});

	it("is wired from SWAGGER_ENABLED and NODE_ENV", () => {
		expect(parse({ SWAGGER_ENABLED: "0" }).http.apiDocs).toEqual({ enabled: false, access: "public" });
		expect(parse(PRODUCTION).http.apiDocs).toEqual({ enabled: false, access: "platform_admin" });
		expect(parse({ ...PRODUCTION, SWAGGER_ENABLED: "1" }).http.apiDocs).toEqual({ enabled: true, access: "platform_admin" });
	});
});

describe("resolveCacheBackend", () => {
	it("honours an explicit backend", () => {
		expect(resolveCacheBackend("memory", "production", "redis://cache:6379")).toBe("memory");
		expect(resolveCacheBackend("redis", "development", undefined)).toBe("redis");
	});

	it("auto-selects redis only outside development and only when Redis is configured", () => {
		expect(resolveCacheBackend("auto", "production", "redis://cache:6379")).toBe("redis");
		expect(resolveCacheBackend("auto", "test", "redis://cache:6379")).toBe("redis");
		expect(resolveCacheBackend("auto", "development", "redis://cache:6379")).toBe("memory");
		expect(resolveCacheBackend("auto", "production", undefined)).toBe("memory");
	});
});

describe("REDIS_NAMESPACE", () => {
	it("uses an explicit namespace as-is", () => {
		expect(resolveRedisNamespace("e2e:run-1", "Any App", "test")).toBe("e2e:run-1");
		expect(parse({ REDIS_NAMESPACE: "tenant-a" }).messaging.redisNamespace).toBe("tenant-a");
	});

	it("derives a deterministic default from APP_NAME and NODE_ENV", () => {
		expect(resolveRedisNamespace(undefined, "NestJS + NextJS Turborepo Starter Template", "development")).toBe("nestjs-nextjs-turborepo-starter-template:development");
		expect(resolveRedisNamespace(undefined, "+++", "production")).toBe("api:production");
	});

	it("keeps a derived default within the 64-character namespace rules", () => {
		const derived: string = resolveRedisNamespace(undefined, "A".repeat(100), "development");
		expect(derived).toMatch(/^[A-Za-z0-9][A-Za-z0-9:_-]{0,63}$/);
		expect(derived.endsWith(":development")).toBe(true);
	});

	it("rejects a namespace outside the Redis-key-safe character rules", () => {
		expect(() => parse({ REDIS_NAMESPACE: "has space" })).toThrow(EnvValidationError);
		expect(() => parse({ REDIS_NAMESPACE: "x".repeat(65) })).toThrow(EnvValidationError);
	});
});

describe("isLoopbackUrl", () => {
	it("recognises every way of saying 'this machine'", () => {
		for (const url of ["http://localhost:3000", "http://LOCALHOST", "http://api.localhost:8080", "http://127.0.0.1:3000", "http://[::1]:3000"]) {
			expect(isLoopbackUrl(url), url).toBe(true);
		}
	});

	it("treats any real host as a deployment", () => {
		for (const url of ["https://app.example.com", "http://10.0.0.5:3000", "https://localhost.example.com", "http://127.0.0.2"]) {
			expect(isLoopbackUrl(url), url).toBe(false);
		}
	});
});

describe("resolveLogLevel", () => {
	it("defaults to info in development so `pnpm dev` lists the mapped routes, and to warn elsewhere", () => {
		expect(resolveLogLevel(undefined, "development")).toBe("info");
		expect(resolveLogLevel(undefined, "test")).toBe("warn");
		expect(resolveLogLevel(undefined, "production")).toBe("warn");
	});

	it("always honours an explicitly configured LOG_LEVEL", () => {
		expect(resolveLogLevel("debug", "production")).toBe("debug");
		expect(resolveLogLevel("error", "development")).toBe("error");
	});
});
