// ============================================
// config/api-config.ts - The ONLY place apps/api/src reads process.env
// ============================================
// `getApiConfig()` parses `process.env` once through `ApiEnvSchema` and
// memoizes the result. `main.ts` calls it before anything else is imported,
// so an invalid environment stops the process before Nest bootstraps, with
// a message that names every bad variable and never prints a value.
// ESLint (`no-restricted-properties`) rejects `process.env` everywhere else.
//
// Runtime `NODE_ENV` is authoritative: the whole `process.env` object is
// handed to the schema, so the bundler's `process.env.NODE_ENV` inlining
// (rspack DefinePlugin, for dependencies) does not apply to our config.

import { parseEnvOrThrow, type EnvSource } from "@workspace/shared";

import { ApiEnvSchema, type ApiConfig } from "./api-config.schema";

/** Scope named in the fail-fast error message. */
export const API_ENV_SCOPE = "apps/api";

/** Parse an env source into the typed config, or throw an `EnvValidationError` (value-free). */
export function parseApiConfig(source: EnvSource): ApiConfig {
	return parseEnvOrThrow(ApiEnvSchema, source, API_ENV_SCOPE);
}

let cachedConfig: ApiConfig | undefined;

/**
 * The process-wide config, parsed from `process.env` on first use. Nest
 * reaches it through `TypedConfigService`; module files that decide their
 * imports at load time (queues enabled only with Redis) call it directly.
 */
export function getApiConfig(): ApiConfig {
	cachedConfig ??= parseApiConfig(process.env);
	return cachedConfig;
}
