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

import { EnvValidationError, parseEnvOrThrow, type EnvSource } from "@workspace/shared";
import { z } from "zod";

import { ApiEnvSchema, type ApiConfig } from "./api-config.schema";

/** Scope named in the fail-fast error message. */
export const API_ENV_SCOPE = "apps/api";

const RetiredDefaultTenantIdSchema = z.object({ DEFAULT_ORGANIZATION_ID: z.string().optional() });

/** Parse an env source into the typed config, or throw an `EnvValidationError` (value-free). */
export function parseApiConfig(source: EnvSource): ApiConfig {
	const retired = RetiredDefaultTenantIdSchema.safeParse(source);
	if (retired.success && retired.data.DEFAULT_ORGANIZATION_ID !== undefined && retired.data.DEFAULT_ORGANIZATION_ID.trim().length > 0) {
		throw new EnvValidationError(API_ENV_SCOPE, [
			{ variable: "DEFAULT_ORGANIZATION_ID", problem: "was renamed to DEFAULT_TENANT_ID. Set DEFAULT_TENANT_ID and remove DEFAULT_ORGANIZATION_ID." },
		]);
	}
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
