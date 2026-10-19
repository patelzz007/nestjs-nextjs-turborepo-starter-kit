// config/api-config/api-config.derivations.ts — Values derived from the environment (docs policy, Redis namespace, log level, cache and storage backends).
// Part of the API environment contract; `../api-config.schema.ts` is its public entry.

import { NodeEnvSchema, type NodeEnv } from "@workspace/shared";

import type { CacheBackend, CacheBackendSetting, LogLevel, StorageProviderSetting } from "../api-env.fields";
import { DEFAULT_LOG_LEVEL_BY_NODE_ENV, LOCAL_CONTAINER_PREFIX } from "./api-config.defaults";
import type { ApiDocsPolicy, MalwareScannerConfig, ObserveConfig } from "./api-config.types";
import type { ApiEnv } from "./api-env.input";

// ── Derivations ────────────────────────────────────────────────────────────

/**
 * Docs exposure: `SWAGGER_ENABLED` when set, otherwise ON outside production
 * and OFF in production. Development/test docs are public; production docs
 * (when opted in) are gated to platform SuperAdmins (`ApiDocsAccessGate`).
 * Every endpoint still enforces authentication and authorization on its own
 * (docs/technical/api/routes.md §9).
 */
export function resolveApiDocsPolicy(swaggerEnabled: boolean | undefined, isProduction: boolean): ApiDocsPolicy {
	return { enabled: swaggerEnabled ?? !isProduction, access: isProduction ? "platform_admin" : "public" };
}

/** `auto` → redis outside development when Redis is configured, otherwise memory. */
/** Longest namespace RedisNamespaceEnvSchema accepts. */
export const MAX_REDIS_NAMESPACE_LENGTH = 64;
/** Fallback slug when APP_NAME holds no letter or digit. */
export const FALLBACK_REDIS_NAMESPACE_APP_SLUG = "api";

/**
 * The Redis namespace: `REDIS_NAMESPACE` when set, else `<app-name-slug>:<NODE_ENV>`
 * (e.g. `nestjs-nextjs-turborepo-starter-template:development`). The default is
 * deterministic, so every instance of one deployment agrees on it without
 * extra config; deployments that share a Redis with the same APP_NAME and
 * NODE_ENV (two local APIs on different databases, staging next to
 * production) MUST set REDIS_NAMESPACE explicitly — e2e and ci:local runs do,
 * per run.
 */
export function resolveRedisNamespace(configured: string | undefined, appName: string, nodeEnv: NodeEnv): string {
	if (configured !== undefined) {
		return configured;
	}
	const slug: string = appName
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	const appSlug: string = (slug === "" ? FALLBACK_REDIS_NAMESPACE_APP_SLUG : slug).slice(0, MAX_REDIS_NAMESPACE_LENGTH - nodeEnv.length - 1).replace(/-+$/, "");
	return `${appSlug}:${nodeEnv}`;
}

/** The configured LOG_LEVEL, or the environment's default ({@link DEFAULT_LOG_LEVEL_BY_NODE_ENV}). */
export function resolveLogLevel(configured: LogLevel | undefined, nodeEnv: NodeEnv): LogLevel {
	return configured ?? DEFAULT_LOG_LEVEL_BY_NODE_ENV[nodeEnv];
}

export function resolveCacheBackend(setting: CacheBackendSetting, nodeEnv: NodeEnv, redisUrl: string | undefined): CacheBackend {
	if (setting !== "auto") {
		return setting;
	}
	return nodeEnv !== NodeEnvSchema.enum.development && redisUrl !== undefined ? "redis" : "memory";
}

/** First configured private container, in precedence order (neutral name first, legacy aliases after). */
export function configuredPrivateContainer(env: ApiEnv): string | undefined {
	return env.STORAGE_PRIVATE_CONTAINER ?? env.STORAGE_S3_PRIVATE_BUCKET ?? env.STORAGE_S3_BUCKET ?? env.FIREBASE_STORAGE_BUCKET;
}

/** Configured public container (neutral name first, legacy S3 alias after). */
export function configuredPublicContainer(env: ApiEnv): string | undefined {
	return env.STORAGE_PUBLIC_CONTAINER ?? env.STORAGE_S3_PUBLIC_BUCKET;
}

/** Explicit `STORAGE_PROVIDER`, else `s3` when a real (non `local-*`) S3 bucket is configured, else `local`. */
export function resolveStorageProvider(env: ApiEnv): StorageProviderSetting {
	if (env.STORAGE_PROVIDER !== undefined) {
		return env.STORAGE_PROVIDER;
	}
	const legacyBucket: string | undefined = env.STORAGE_S3_PRIVATE_BUCKET ?? env.STORAGE_S3_BUCKET;
	return legacyBucket !== undefined && !legacyBucket.startsWith(LOCAL_CONTAINER_PREFIX) ? "s3" : "local";
}

export function resolveMalwareScannerConfig(env: ApiEnv): MalwareScannerConfig {
	return { kind: env.MALWARE_SCANNER };
}

export function resolveObserveConfig(env: ApiEnv): ObserveConfig | null {
	const enabled: boolean = env.OBSERVE_ENABLED ?? env.NODE_ENV === NodeEnvSchema.enum.production;
	if (!enabled || env.OBSERVE_APP_KEY === undefined || env.OBSERVE_APP_SECRET === undefined) {
		return null;
	}
	return { appKey: env.OBSERVE_APP_KEY, appSecret: env.OBSERVE_APP_SECRET, serviceId: env.OBSERVE_SERVICE_ID };
}
