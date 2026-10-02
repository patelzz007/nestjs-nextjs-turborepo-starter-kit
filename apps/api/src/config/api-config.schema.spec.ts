import { EnvValidationError } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { TEST_API_ENV, type TestEnv } from "../../test/support/test-api-env";
import { API_ENV_SCOPE, parseApiConfig } from "./api-config";
import { isLoopbackUrl, resolveApiDocsPolicy, resolveCacheBackend, type ApiConfig } from "./api-config.schema";

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

const PRODUCTION: TestEnv = { NODE_ENV: "production", REDIS_URL: "redis://cache.internal:6379" };

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

		expect(config.http).toMatchObject({ host: "127.0.0.1", port: 8080, publicUrl: "http://127.0.0.1:8080", trustProxy: false, shutdownTimeoutMs: 15_000 });
		expect(config.database).toMatchObject({ poolMax: 10, idleTimeoutMs: 30_000, allowExitOnIdle: true });
		expect(config.auth).toMatchObject({ jwtAccessExpiry: "15m", jwtRefreshExpiry: "7d", twoFactorIssuer: "hello-world", forceLoginVerification: false });
		expect(config.rateLimits).toEqual({ throttleDefaultLimit: 300, throttleStrictLimit: 30, throttleTtlMs: 60_000, securityCounterMaxKeys: 50_000 });
		expect(config.observability).toEqual({ logLevel: "warn", memoryMonitoring: false, observe: null });
		expect(config.tenancy).toEqual({ enabled: false, defaultOrganizationId: "default" });
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

			expect(error.issues[0]?.problem).toMatch(/at least 32 characters/);
			expect(error.message).not.toContain(short);
		});

		it("rejects the .env.example placeholder even though it is long enough", () => {
			const error = captureEnvError({ JWT_REFRESH_SECRET: "change-me-run-pnpm-secrets-generate" });

			expect(error.issues[0]?.problem).toMatch(/placeholder/);
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
			expect(config.mfa.encryptionKeys[2]).toBe(Buffer.alloc(32, 3).toString("base64"));
		});

		it("rejects non-JSON, an empty ring, bad versions and keys that are not 32 bytes — without printing the key", () => {
			const wrongLength = Buffer.alloc(128, 4).toString("base64");

			expect(captureEnvError({ MFA_ENCRYPTION_KEYS: "not json" }).issues[0]?.problem).toMatch(/JSON object/);
			expect(captureEnvError({ MFA_ENCRYPTION_KEYS: "{}" }).issues[0]?.problem).toMatch(/at least one key version/);
			expect(captureEnvError({ MFA_ENCRYPTION_KEYS: JSON.stringify({ zero: KEY_32_BYTES }) }).variables).toEqual(["MFA_ENCRYPTION_KEYS.zero"]);
			const lengthError = captureEnvError({ MFA_ENCRYPTION_KEYS: JSON.stringify({ 1: wrongLength }) });
			expect(lengthError.issues).toEqual([{ variable: "MFA_ENCRYPTION_KEYS.1", problem: "must decode to exactly 32 bytes (generate with: openssl rand -base64 32)" }]);
			expect(lengthError.message).not.toContain(wrongLength);
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
			expect(formatError.issues[0]?.problem).toMatch(/standard base64/);
			expect(formatError.message).not.toContain(notBase64);
			expect(captureEnvError({ TENANT_ENCRYPTION_MASTER_KEY: sixteenBytes }).issues[0]?.problem).toMatch(/exactly 32 bytes/);
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
			expect(captureEnvError({ JWT_ACCESS_EXPIRY: "15 minutes" }).variables).toEqual(["JWT_ACCESS_EXPIRY"]);
		});

		it("accepts the 0/1/true/false toggle spellings and rejects anything else", () => {
			expect(parse({ TRUST_PROXY: "1" }).http.trustProxy).toBe(true);
			expect(parse({ TRUST_PROXY: " TRUE " }).http.trustProxy).toBe(true);
			expect(parse({ TRUST_PROXY: "0" }).http.trustProxy).toBe(false);
			expect(captureEnvError({ SWAGGER_ENABLED: "yes" }).issues).toEqual([{ variable: "SWAGGER_ENABLED", problem: "must be one of 0, 1, false, true" }]);
		});

		it("requires true/false (not 0/1) for the boolean feature flags", () => {
			expect(parse({ TENANCY_ENABLED: "true" }).tenancy.enabled).toBe(true);
			expect(captureEnvError({ FORCE_LOGIN_VERIFICATION: "1" }).variables).toEqual(["FORCE_LOGIN_VERIFICATION"]);
		});

		it("parses Kafka brokers, Redis and AMQP URLs", () => {
			const config = parse({ KAFKA_BROKERS: "k1:9092, k2:9093", REDIS_URL: "rediss://cache:6380", RABBITMQ_URL: "amqp://mq:5672" });

			expect(config.messaging).toMatchObject({ kafkaBrokers: ["k1:9092", "k2:9093"], redisUrl: "rediss://cache:6380", rabbitmqUrl: "amqp://mq:5672" });
			expect(captureEnvError({ KAFKA_BROKERS: "k1" }).variables).toEqual(["KAFKA_BROKERS.0"]);
			expect(captureEnvError({ REDIS_URL: "http://cache:6379" }).variables).toEqual(["REDIS_URL"]);
		});
	});

	describe("cross-field rules", () => {
		it("requires RESEND_API_KEY when EMAIL_MODE=send, but not for log-only / noop", () => {
			expect(captureEnvError({ EMAIL_MODE: "send", RESEND_API_KEY: undefined }).issues).toEqual([
				{ variable: "RESEND_API_KEY", problem: "is required when EMAIL_MODE=send (set EMAIL_MODE=log-only or noop to run without Resend)" },
			]);
			expect(parse({ EMAIL_MODE: "log-only", RESEND_API_KEY: undefined }).email.resendApiKey).toBeNull();
		});

		it("forbids EMAIL_TEST_TO on a deployed production environment and requires REDIS_URL in production", () => {
			expect(captureEnvError({ NODE_ENV: "production", APP_URL: "https://app.example.com", EMAIL_TEST_TO: "dev@example.com" }).variables).toEqual([
				"EMAIL_TEST_TO",
				"REDIS_URL",
			]);
			expect(captureEnvError({ NODE_ENV: "production" }).variables).toEqual(["REDIS_URL"]);
			expect(parse(PRODUCTION).runtime.isProduction).toBe(true);
			expect(parse({ EMAIL_TEST_TO: "dev@example.com" }).email.testTo).toBe("dev@example.com");
		});

		it("allows EMAIL_TEST_TO for a production build running on localhost", () => {
			const local = parse({ ...PRODUCTION, APP_URL: "http://localhost:3000", EMAIL_TEST_TO: "dev@example.com" });
			expect(local.runtime.isProduction).toBe(true);
			expect(local.email.testTo).toBe("dev@example.com");
			expect(parse({ ...PRODUCTION, APP_URL: "http://127.0.0.1:3000", EMAIL_TEST_TO: "dev@example.com" }).email.testTo).toBe("dev@example.com");
		});

		it("requires both halves of the AWS key pair", () => {
			expect(captureEnvError({ AWS_ACCESS_KEY_ID: "AKIATESTONLY" }).variables).toEqual(["AWS_SECRET_ACCESS_KEY"]);
			expect(captureEnvError({ AWS_SECRET_ACCESS_KEY: "test-only-secret" }).variables).toEqual(["AWS_ACCESS_KEY_ID"]);
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
			expect(captureEnvError({ STORAGE_PROVIDER: "s3" }).variables).toEqual(["STORAGE_PRIVATE_CONTAINER"]);
			expect(captureEnvError({ STORAGE_PROVIDER: "firebase" }).variables).toEqual(["STORAGE_PRIVATE_CONTAINER"]);
			expect(parse({ STORAGE_PROVIDER: "firebase", FIREBASE_STORAGE_BUCKET: "app.appspot.com" }).storage.privateContainer).toBe("app.appspot.com");
		});
	});

	describe("derived values", () => {
		it("auto-detects s3 from a legacy bucket name, but never from a local-* container", () => {
			expect(parse({ STORAGE_S3_BUCKET: "rewardhub" }).storage).toMatchObject({ provider: "s3", privateContainer: "rewardhub" });
			expect(parse({ STORAGE_S3_BUCKET: "local-dev" }).storage.provider).toBe("local");
		});

		it("prefers the neutral container names over the legacy aliases", () => {
			const storage = parse({
				STORAGE_PRIVATE_CONTAINER: "neutral",
				STORAGE_S3_BUCKET: "legacy",
				STORAGE_PUBLIC_CONTAINER: "public",
				STORAGE_S3_PUBLIC_BUCKET: "legacy-public",
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
	it("is ON by default in every environment", () => {
		expect(resolveApiDocsPolicy(undefined)).toEqual({ enabled: true });
	});

	it("follows SWAGGER_ENABLED when set", () => {
		expect(resolveApiDocsPolicy(false)).toEqual({ enabled: false });
		expect(resolveApiDocsPolicy(true)).toEqual({ enabled: true });
	});

	it("is wired from SWAGGER_ENABLED, never from NODE_ENV", () => {
		expect(parse({ SWAGGER_ENABLED: "0" }).http.apiDocs).toEqual({ enabled: false });
		expect(parse(PRODUCTION).http.apiDocs).toEqual({ enabled: true });
		expect(parse({ ...PRODUCTION, SWAGGER_ENABLED: "0" }).http.apiDocs).toEqual({ enabled: false });
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
