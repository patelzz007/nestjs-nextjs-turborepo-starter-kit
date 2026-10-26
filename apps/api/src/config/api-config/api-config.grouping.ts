// config/api-config/api-config.grouping.ts — The flat environment grouped into `ApiConfig`.
// Part of the API environment contract; `../api-config.schema.ts` is its public entry.

import { NodeEnvSchema, type GithubRepositoryParams, type NodeEnv } from "@workspace/shared";
import { toKafkaSecurityOptions } from "@workspace/messaging/kafka";

import { resolveApiPublicUrl } from "../api-public-url";
import { toGithubRepositoryParams, type StorageProviderSetting } from "../api-env.fields";
import {
	DEFAULT_STORAGE_DOWNLOAD_TTL_SECONDS,
	LOCAL_PRIVATE_CONTAINER,
	LOCAL_PUBLIC_CONTAINER,
	NON_PRODUCTION_STORAGE_PHYSICAL_DELETE_DELAY_MS,
	NON_PRODUCTION_TENANT_KMS_PROVIDER,
	PRODUCTION_STORAGE_PHYSICAL_DELETE_DELAY_MS,
} from "./api-config.defaults";
import {
	configuredPrivateContainer,
	configuredPublicContainer,
	resolveApiDocsPolicy,
	resolveCacheBackend,
	resolveLogLevel,
	resolveMalwareScannerConfig,
	resolveObserveConfig,
	resolveRedisNamespace,
	resolveStorageProvider,
} from "./api-config.derivations";
import type { ApiConfig, TenancyConfig } from "./api-config.types";
import type { ApiEnv } from "./api-env.input";

// ── Grouping ───────────────────────────────────────────────────────────────

/** Single mode with its tenant id (guaranteed by `checkApiEnvRules`), or multi mode with no fallback id. */
export function resolveTenancy(env: ApiEnv): TenancyConfig {
	if (env.TENANCY_ENABLED) {
		return { mode: "multi" };
	}
	if (env.DEFAULT_TENANT_ID === undefined) {
		throw new Error("DEFAULT_TENANT_ID is required in single-tenant mode (checkApiEnvRules enforces this)");
	}
	return { mode: "single", defaultTenantId: env.DEFAULT_TENANT_ID };
}

/** Groups the validated flat environment into the typed `ApiConfig`. */
export function toApiConfig(env: ApiEnv): ApiConfig {
	const nodeEnv: NodeEnv = env.NODE_ENV;
	const isProduction: boolean = nodeEnv === NodeEnvSchema.enum.production;
	const provider: StorageProviderSetting = resolveStorageProvider(env);

	return {
		runtime: {
			nodeEnv,
			isProduction,
			isDevelopment: nodeEnv === NodeEnvSchema.enum.development,
			isTest: nodeEnv === NodeEnvSchema.enum.test,
			appName: env.APP_NAME,
		},
		http: {
			host: env.HOST,
			port: env.PORT,
			// Never the listen wildcard (0.0.0.0 is unreachable for a client): see api-public-url.ts.
			publicUrl: resolveApiPublicUrl({ configuredUrl: env.API_PUBLIC_URL, host: env.HOST, port: env.PORT, isDevelopment: nodeEnv === NodeEnvSchema.enum.development }),
			trustedProxies: env.TRUST_PROXY,
			corsOrigins: env.CORS_ORIGINS,
			cookieDomain: env.COOKIE_DOMAIN,
			securityHardeningEnabled: env.SECURITY_HARDENING_ENABLED ?? isProduction,
			apiDocs: resolveApiDocsPolicy(env.SWAGGER_ENABLED, isProduction),
			shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS,
		},
		clientApps: { webUrl: env.APP_URL, adminUrl: env.ADMIN_APP_URL, merchantUrl: env.MERCHANT_APP_URL },
		database: { url: env.DATABASE_URL, poolMax: env.DB_POOL_MAX, idleTimeoutMs: env.DB_IDLE_TIMEOUT_MS, allowExitOnIdle: !isProduction },
		auth: {
			jwtAccessSecret: env.JWT_ACCESS_SECRET,
			jwtAccessExpiry: env.JWT_ACCESS_EXPIRY,
			jwtRefreshSecret: env.JWT_REFRESH_SECRET,
			jwtRefreshExpiry: env.JWT_REFRESH_EXPIRY,
			emailVerificationSecret: env.EMAIL_VERIFICATION_SECRET,
			twoFactorPendingSecret: env.TWO_FACTOR_PENDING_SECRET,
			twoFactorIssuer: env.TWO_FACTOR_ISSUER ?? env.APP_NAME,
			loginVerificationMode: env.LOGIN_VERIFICATION_MODE,
			bcryptSaltRounds: env.BCRYPT_SALT_ROUNDS,
		},
		mfa: {
			encryptionKeys: env.MFA_ENCRYPTION_KEYS,
			enrollmentDeadlineMs: env.MFA_ENROLLMENT_DEADLINE_MS,
			recoveryDelayMs: env.MFA_RECOVERY_DELAY_MS,
			stepUpTtlMs: env.MFA_STEP_UP_TTL_MS,
		},
		mobile: { minSupportedVersion: env.MOBILE_MIN_SUPPORTED_VERSION },
		sessions: { locationProvider: env.SESSION_LOCATION_PROVIDER, locationTimeoutMs: env.SESSION_LOCATION_TIMEOUT_MS },
		github: {
			token: env.GITHUB_TOKEN ?? null,
			repositories: (env.GITHUB_REPOSITORIES ?? []).flatMap((fullName: string): GithubRepositoryParams[] => {
				const params = toGithubRepositoryParams(fullName);
				return params === null ? [] : [params];
			}),
			requestTimeoutMs: env.GITHUB_REQUEST_TIMEOUT_MS,
			cacheTtlMs: env.GITHUB_CACHE_TTL_MS,
			credentialEncryptionKeys: env.GITHUB_CREDENTIAL_ENCRYPTION_KEYS ?? null,
			webhook: env.GITHUB_WEBHOOK_URL === undefined || env.GITHUB_WEBHOOK_SECRET === undefined ? null : { url: env.GITHUB_WEBHOOK_URL, secret: env.GITHUB_WEBHOOK_SECRET },
		},
		encryption: {
			tenantMasterKey: env.TENANT_ENCRYPTION_MASTER_KEY,
			tenantMasterKeyVersion: env.TENANT_ENCRYPTION_MASTER_KEY_VERSION,
			tenantPreviousMasterKeys: env.TENANT_ENCRYPTION_PREVIOUS_MASTER_KEYS ?? {},
			tenantKmsProvider: env.TENANT_KMS_PROVIDER ?? NON_PRODUCTION_TENANT_KMS_PROVIDER,
			tenantJobHmacSecret: env.TENANT_JOB_HMAC_SECRET ?? null,
			rewardCodeHashKeys: env.REWARD_CODE_HASH_KEYS,
		},
		email: {
			mode: env.EMAIL_MODE,
			provider: env.EMAIL_PROVIDER,
			resendApiKey: env.RESEND_API_KEY ?? null,
			mailpitUrl: env.MAILPIT_URL,
			fromAddress: env.EMAIL_FROM_ADDRESS,
			replyTo: env.EMAIL_REPLY_TO,
			testTo: env.EMAIL_TEST_TO,
			maxAttempts: env.EMAIL_MAX_ATTEMPTS,
			timeoutMs: env.EMAIL_TIMEOUT_MS,
			rateLimitPerMinute: env.EMAIL_RATE_LIMIT_PER_MINUTE,
			resendWebhookSecret: env.RESEND_WEBHOOK_SECRET ?? null,
			webhookRateLimitPerMinute: env.WEBHOOK_RATE_LIMIT_PER_MINUTE,
		},
		rateLimits: {
			throttleDefaultLimit: env.THROTTLE_DEFAULT_LIMIT,
			throttleStrictLimit: env.THROTTLE_STRICT_LIMIT,
			throttleTtlMs: env.THROTTLE_TTL_MS,
			securityCounterMaxKeys: env.SECURITY_COUNTER_MAX_KEYS,
		},
		caches: {
			authorizationBackend: resolveCacheBackend(env.AUTHORIZATION_CACHE_BACKEND, nodeEnv, env.REDIS_URL),
			authorizationTtlMs: env.AUTHORIZATION_CACHE_TTL_MS,
			authorizationMaxEntries: env.AUTHORIZATION_CACHE_MAX_ENTRIES,
			userSessionBackend: resolveCacheBackend(env.USER_SESSION_CACHE_BACKEND, nodeEnv, env.REDIS_URL),
			userSessionTtlMs: env.USER_SESSION_CACHE_TTL_MS,
			userSessionMaxEntries: env.USER_SESSION_CACHE_MAX_ENTRIES,
			accessTokenStateTtlMs: env.ACCESS_TOKEN_STATE_CACHE_TTL_MS,
			accessTokenStateMaxEntries: env.ACCESS_TOKEN_STATE_CACHE_MAX_ENTRIES,
		},
		messaging: {
			redisUrl: env.REDIS_URL,
			kafkaBrokers: env.KAFKA_BROKERS,
			kafkaSecurity: toKafkaSecurityOptions(env),
			kafkaDeliveryTimeoutMs: env.KAFKA_DELIVERY_TIMEOUT_MS,
			rabbitmqUrl: env.RABBITMQ_URL,
			clientId: env.MESSAGING_CLIENT_ID,
			connectionName: env.MESSAGING_CONNECTION_NAME,
			bullPrefix: env.BULLMQ_PREFIX,
			redisNamespace: resolveRedisNamespace(env.REDIS_NAMESPACE, env.APP_NAME, nodeEnv),
		},
		storage: {
			provider,
			privateContainer: configuredPrivateContainer(env) ?? LOCAL_PRIVATE_CONTAINER,
			publicContainer: configuredPublicContainer(env) ?? LOCAL_PUBLIC_CONTAINER,
			firebaseProjectId: env.FIREBASE_PROJECT_ID ?? null,
			firebaseStorageBucket: env.FIREBASE_STORAGE_BUCKET ?? null,
			cloudfrontPublicDomain: env.STORAGE_CLOUDFRONT_PUBLIC_DOMAIN ?? null,
			cloudfrontDistributionId: env.STORAGE_CLOUDFRONT_DISTRIBUTION_ID ?? null,
			awsRegion: env.AWS_REGION,
			downloadTtlSeconds: env.STORAGE_DOWNLOAD_TTL_SECONDS ?? env.KYB_DOCUMENT_DOWNLOAD_TTL_SECONDS ?? DEFAULT_STORAGE_DOWNLOAD_TTL_SECONDS,
			physicalDeleteDelayMs:
				env.STORAGE_PHYSICAL_DELETE_DELAY_MS ?? (isProduction ? PRODUCTION_STORAGE_PHYSICAL_DELETE_DELAY_MS : NON_PRODUCTION_STORAGE_PHYSICAL_DELETE_DELAY_MS),
			processingCallbackSecret: env.STORAGE_PROCESSING_CALLBACK_SECRET ?? null,
			malwareScanner: resolveMalwareScannerConfig(env),
		},
		observability: {
			logLevel: resolveLogLevel(env.LOG_LEVEL, nodeEnv),
			memoryMonitoring: isProduction || env.MEMORY_MONITORING,
			memoryLeakDetection: {
				warmupMs: env.MEMORY_LEAK_WARMUP_MS,
				windowMs: env.MEMORY_LEAK_WINDOW_MS,
				growthThresholdMb: env.MEMORY_LEAK_GROWTH_THRESHOLD_MB,
			},
			// On everywhere but under tests, which must not leave files behind; TRANSACTION_LOG_ENABLED decides when set.
			transactionLog:
				(env.TRANSACTION_LOG_ENABLED ?? nodeEnv !== NodeEnvSchema.enum.test)
					? { directory: env.TRANSACTION_LOG_DIR, retentionDays: env.TRANSACTION_LOG_RETENTION_DAYS }
					: null,
			observe: resolveObserveConfig(env),
		},
		tenancy: resolveTenancy(env),
	};
}

/** Flat env → validated → cross-checked → grouped. */
