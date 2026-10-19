// ============================================
// config/api-config.schema.ts - THE contract for the API's environment
// ============================================
// One zod schema for every variable apps/api reads. It is pure (never
// touches `process.env`): `api-config.ts` hands it the source record and
// parses it once, at startup, through `parseEnvOrThrow` — which lists every
// invalid/missing variable by name and never prints a value.
//
// The flat, variable-named input is transformed into a grouped, typed
// `ApiConfig`. `TypedConfigService` exposes it to the Nest graph.
// See docs/technical/configuration/api.md.
//
// The contract is split by concern under `api-config/`; this file is its one
// public entry (every caller keeps importing from here).

import { checkApiEnvRules } from "./api-config/api-env.rules";
import { ApiEnvInputSchema } from "./api-config/api-env.input";
import { toApiConfig } from "./api-config/api-config.grouping";

export { ApiEnvInputSchema, type ApiEnv } from "./api-config/api-env.input";
export {
	type ApiConfig,
	type ApiDocsAccess,
	type ApiDocsPolicy,
	type AuthConfig,
	type CacheConfig,
	type ClientAppsConfig,
	type DatabaseConfig,
	type EmailConfig,
	type EncryptionConfig,
	type GithubConfig,
	type HttpConfig,
	type MalwareScannerConfig,
	type MemoryLeakDetectionConfig,
	type MessagingConfig,
	type MfaConfig,
	type MobileConfig,
	type ObservabilityConfig,
	type ObserveConfig,
	type RateLimitConfig,
	type RuntimeConfig,
	type SessionsConfig,
	type StorageConfig,
	type TenancyConfig,
} from "./api-config/api-config.types";
export { resolveApiDocsPolicy, resolveCacheBackend, resolveLogLevel, resolveRedisNamespace, resolveStorageProvider } from "./api-config/api-config.derivations";
export { checkApiEnvRules, isLoopbackUrl } from "./api-config/api-env.rules";
export { toApiConfig } from "./api-config/api-config.grouping";

export const ApiEnvSchema = ApiEnvInputSchema.superRefine(checkApiEnvRules).transform(toApiConfig);
