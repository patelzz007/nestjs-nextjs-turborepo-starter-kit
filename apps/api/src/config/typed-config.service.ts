import type {
	ApiConfig,
	AuthConfig,
	CacheConfig,
	ClientAppsConfig,
	DatabaseConfig,
	EmailConfig,
	EncryptionConfig,
	HttpConfig,
	MessagingConfig,
	MfaConfig,
	ObservabilityConfig,
	RateLimitConfig,
	RuntimeConfig,
	StorageConfig,
	TenancyConfig,
} from "./api-config.schema";
import { RedisNamespace } from "../infrastructure/redis/redis-namespace";

/** Client apps an auth flow can originate from (`X-Client-Type`). */
const ADMIN_CLIENT_TYPE = "admin";
const MERCHANT_CLIENT_TYPE = "merchant";

/**
 * Typed, read-only access to the API configuration.
 *
 * Backed by the `ApiConfig` that `api-config.ts` parsed ONCE from the
 * environment through the zod schema in `api-config.schema.ts` — nothing
 * here reads `process.env`, applies a fallback, or can fail at request time.
 * Each config group (`runtime`, `http`, `email`, …) is exposed as-is (the
 * field docs live on the group interfaces in `api-config.schema.ts`); the
 * remaining members DERIVE something from one or more groups.
 * Provided by the global `ConfigModule`; tests build one from a fixture with
 * `createTestTypedConfig()` (test/support/test-api-env.ts).
 */
export class TypedConfigService {
	public constructor(private readonly config: ApiConfig) {}

	// ── Config groups ──────────────────────────────────────────────────

	public get runtime(): RuntimeConfig {
		return this.config.runtime;
	}

	public get http(): HttpConfig {
		return this.config.http;
	}

	public get clientApps(): ClientAppsConfig {
		return this.config.clientApps;
	}

	public get database(): DatabaseConfig {
		return this.config.database;
	}

	public get auth(): AuthConfig {
		return this.config.auth;
	}

	public get mfa(): MfaConfig {
		return this.config.mfa;
	}

	/** Raw key material; prefer the decoded {@link tenantEncryptionMasterKey} / {@link tenantEncryptionPreviousMasterKeys} copies. */
	public get encryption(): EncryptionConfig {
		return this.config.encryption;
	}

	public get email(): EmailConfig {
		return this.config.email;
	}

	public get rateLimits(): RateLimitConfig {
		return this.config.rateLimits;
	}

	public get caches(): CacheConfig {
		return this.config.caches;
	}

	public get messaging(): MessagingConfig {
		return this.config.messaging;
	}

	/**
	 * Object storage. There are deliberately no credentials here: the S3
	 * client resolves them through the AWS SDK default chain (IAM role in
	 * deployments, an SSO profile or local keys in development).
	 */
	public get storage(): StorageConfig {
		return this.config.storage;
	}

	public get observability(): ObservabilityConfig {
		return this.config.observability;
	}

	public get tenancy(): TenancyConfig {
		return this.config.tenancy;
	}

	// ── Derived values ─────────────────────────────────────────────────

	/** Auth cookies carry `Secure` in production. */
	public get secureCookies(): boolean {
		return this.config.runtime.isProduction;
	}

	/** Resolve the frontend base URL for a given auth client type. */
	public resolveClientAppUrl(clientType: string | undefined): string {
		if (clientType === ADMIN_CLIENT_TYPE) {
			return this.config.clientApps.adminUrl;
		}
		if (clientType === MERCHANT_CLIENT_TYPE) {
			return this.config.clientApps.merchantUrl;
		}
		return this.config.clientApps.webUrl;
	}

	/** Decoded 32-byte tenant master key (a fresh copy per call — callers cannot mutate the config). */
	public get tenantEncryptionMasterKey(): Buffer {
		return Buffer.from(this.config.encryption.tenantMasterKey, "base64");
	}

	/** Decoded retired tenant master keys by version (fresh copies per call). */
	public get tenantEncryptionPreviousMasterKeys(): ReadonlyMap<number, Buffer> {
		return new Map(
			Object.entries(this.config.encryption.tenantPreviousMasterKeys).map(([version, key]: [string, string]): [number, Buffer] => [
				Number(version),
				Buffer.from(key, "base64"),
			]),
		);
	}

	public get useRedisAuthorizationCache(): boolean {
		return this.config.caches.authorizationBackend === "redis" && this.config.messaging.redisUrl !== undefined;
	}

	public get useRedisUserSessionCache(): boolean {
		return this.config.caches.userSessionBackend === "redis" && this.config.messaging.redisUrl !== undefined;
	}

	/** The namespace every raw Redis key and pub/sub channel is built with (`REDIS_NAMESPACE`). */
	public get redisNamespace(): RedisNamespace {
		return new RedisNamespace(this.config.messaging.redisNamespace);
	}

	/** Whether BullMQ workers and producers should be active. */
	public get useBullMq(): boolean {
		return this.config.messaging.redisUrl !== undefined;
	}

	/** Whether the Kafka producer and event bridge should be active. */
	public get useKafka(): boolean {
		return this.config.messaging.kafkaBrokers !== undefined;
	}

	public get useLocalStorage(): boolean {
		return this.config.storage.provider === "local";
	}

	/** Prisma query/info event logging (LOG_LEVEL debug or trace). */
	public get isDebugLogging(): boolean {
		return this.config.observability.logLevel === "debug" || this.config.observability.logLevel === "trace";
	}

	/** The organization a single-tenant deployment serves; `null` in multi-tenant mode. */
	public get singleTenantOrganizationId(): string | null {
		return this.config.tenancy.enabled ? null : this.config.tenancy.singleTenantOrganizationId;
	}
}
