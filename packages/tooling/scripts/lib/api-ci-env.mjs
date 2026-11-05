/**
 * The throwaway apps/api env every database-backed CI job boots the API with,
 * in ONE place: `.github/actions/write-api-ci-env` writes it through
 * scripts/write-api-ci-env.mjs, and `pnpm ci:local` writes the same file for
 * its throwaway databases and points the API at it (`DOTENV_PATH`), so a local
 * run never borrows a setting from the developer's own apps/api/.env.
 *
 * Signing secrets and encryption keys are random per run. Redis, Kafka and
 * RabbitMQ stay unset: the API falls back to in-memory caches and skips the
 * broker/queue integrations. Every encryption key ring the seed needs is set,
 * so `pnpm db:seed` seals its demo GitHub links and push devices and the seed
 * coverage check sees those tables populated. apps/api's ci-workflow-env.spec.ts
 * runs the output through the API's config schema, so it cannot drift.
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { parseProjectIdentity } from "./project-identity.mjs";

/** The project's identity (project.json), so the CI app is named after the project. */
const PROJECT = parseProjectIdentity(readFileSync(path.resolve(import.meta.dirname, "../../../../project.json"), "utf8"));

/** Bytes in each generated secret or key. */
const SECRET_BYTES = 32;

/** @typedef {"hex" | "base64"} SecretFormat */
/** @typedef {"multi" | "single"} TenancyMode */
/** @typedef {(format: SecretFormat) => string} SecretSource */

/**
 * The generated secrets: the env name, how it is generated, and whether it is a
 * versioned key ring (`{"1":"<key>"}`).
 *
 * @type {readonly { readonly name: string; readonly format: SecretFormat; readonly keyRing: boolean }[]}
 */
export const API_CI_SECRETS = [
	{ name: "JWT_ACCESS_SECRET", format: "hex", keyRing: false },
	{ name: "JWT_REFRESH_SECRET", format: "hex", keyRing: false },
	{ name: "EMAIL_VERIFICATION_SECRET", format: "hex", keyRing: false },
	{ name: "TWO_FACTOR_PENDING_SECRET", format: "hex", keyRing: false },
	{ name: "MFA_ENCRYPTION_KEYS", format: "base64", keyRing: true },
	{ name: "REWARD_CODE_HASH_KEYS", format: "base64", keyRing: true },
	// Exactly 32 bytes, base64 (validated at boot).
	{ name: "TENANT_ENCRYPTION_MASTER_KEY", format: "base64", keyRing: false },
	// GitHub pull requests on: the seed seals its demo GitHub links.
	{ name: "GITHUB_CREDENTIAL_ENCRYPTION_KEYS", format: "base64", keyRing: true },
	// Push device tokens are sealed at rest: without it the seed has no devices to write.
	{ name: "NOTIFICATIONS_ENCRYPTION_KEYS", format: "base64", keyRing: true },
	// Outgoing webhook signing secrets are sealed at rest: without it the seed has no endpoint to write (ADR 082).
	{ name: "WEBHOOK_SECRET_ENCRYPTION_KEYS", format: "base64", keyRing: true },
];

/** The fixed, non-secret settings, in the order they are written. */
const API_CI_SETTINGS = [
	["NODE_ENV", "test"],
	["JWT_ACCESS_EXPIRY", "15m"],
	["JWT_REFRESH_EXPIRY", "7d"],
	["BCRYPT_SALT_ROUNDS", "10"],
	["LOGIN_VERIFICATION_MODE", "disabled"],
	// CI must not depend on Have I Been Pwned being reachable (the adapter has its own tests).
	["PASSWORD_BREACH_CHECK", "off"],
	["EMAIL_MODE", "noop"],
	["EMAIL_FROM_ADDRESS", "noreply@example.com"],
	["STORAGE_PROVIDER", "local"],
	["MALWARE_SCANNER", "none"],
	["APP_NAME", `${PROJECT.displayName} CI`],
	// Explicit Redis namespace (inert while REDIS_URL is unset; the e2e suite forces its own per run).
	["REDIS_NAMESPACE", `${PROJECT.slug}-ci`],
	// The address the API puts in links it hands out (local-storage upload and file URLs). It must be the
	// origin the apps call (`NEXT_PUBLIC_API_URL`), or their content security policy refuses the upload: left
	// unset, the API would advertise its bind host, 127.0.0.1, which is a different origin from localhost.
	["API_PUBLIC_URL", "http://localhost:8080"],
	["APP_URL", "http://localhost:3000"],
	["ADMIN_APP_URL", "http://localhost:3001"],
	["MERCHANT_APP_URL", "http://localhost:3003"],
	["CORS_ORIGINS", "http://localhost:3000,http://localhost:3001,http://localhost:3003"],
	["COOKIE_DOMAIN", "localhost"],
];

/** @type {SecretSource} */
export function randomSecret(format) {
	return randomBytes(SECRET_BYTES).toString(format);
}

/**
 * The env as ordered `[name, value]` pairs, and the secret values to mask in CI logs.
 *
 * @param {{ databaseUrl: string; tenancyMode: TenancyMode; defaultTenantId?: string | undefined; secret?: SecretSource }} options
 * @returns {{ entries: readonly (readonly [string, string])[]; secrets: readonly string[] }}
 */
export function apiCiEnv({ databaseUrl, tenancyMode, defaultTenantId, secret = randomSecret }) {
	if (databaseUrl.length === 0) {
		throw new Error("apiCiEnv needs a database URL");
	}
	const secrets = [];
	const secretEntries = API_CI_SECRETS.map(({ name, format, keyRing }) => {
		const value = secret(format);
		secrets.push(value);
		return /** @type {const} */ ([name, keyRing ? JSON.stringify({ 1: value }) : value]);
	});
	return {
		entries: [["DATABASE_URL", databaseUrl], ...API_CI_SETTINGS, ...secretEntries, ...tenancyEntries(tenancyMode, defaultTenantId)],
		secrets,
	};
}

/**
 * Multi mode has no default tenant (multi-tenancy plan D12); single mode serves exactly one.
 *
 * @param {TenancyMode} mode
 * @param {string | undefined} defaultTenantId
 * @returns {readonly (readonly [string, string])[]}
 */
function tenancyEntries(mode, defaultTenantId) {
	if (mode === "multi") {
		return [["TENANCY_ENABLED", "true"]];
	}
	if (mode === "single") {
		if (defaultTenantId === undefined || defaultTenantId.length === 0) {
			throw new Error("single tenancy mode needs a default tenant id");
		}
		return [
			["TENANCY_ENABLED", "false"],
			["DEFAULT_TENANT_ID", defaultTenantId],
		];
	}
	throw new Error(`tenancy mode must be multi or single, got '${String(mode)}'`);
}

/**
 * The entries as a .env file. Values are single-line by construction (URLs, ids,
 * hex, base64 and compact JSON), so no quoting is needed.
 *
 * @param {readonly (readonly [string, string])[]} entries
 */
export function renderEnvFile(entries) {
	return `${entries.map(([name, value]) => `${name}=${value}`).join("\n")}\n`;
}
