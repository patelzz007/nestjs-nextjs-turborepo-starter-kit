// ============================================
// config/api-env.fields.ts - Field schemas used only by the API env schema
// ============================================
// Generic building blocks (URLs, integers, lists, NODE_ENV …) live in
// `@workspace/shared` (runtime/app-env.ts) because several apps use them.
// The schemas here encode API-only formats: secrets, AES keys, JWT expiry,
// the legacy 0/1 toggles, and the closed option sets of API features.

import { commaSeparatedEnvSchema, HttpUrlEnvSchema, JsonValueSchema, type JsonValue } from "@workspace/shared";
import { z } from "zod";

// ── Toggles ────────────────────────────────────────────────────────────────

/** Spellings accepted by the API's on/off switches (`TRUST_PROXY=1`, `SWAGGER_ENABLED=false`, …). */
export const ToggleValueSchema = z.enum(["0", "1", "false", "true"], { error: "must be one of 0, 1, false, true" });

/**
 * On/off switch. Unset stays `undefined` so the caller can apply an
 * environment-dependent default (e.g. Swagger on in development, off in
 * production). Any other spelling fails fast instead of being guessed.
 */
export const OptionalToggleEnvSchema = z
	.string()
	.trim()
	.toLowerCase()
	.pipe(ToggleValueSchema)
	.transform((value: z.output<typeof ToggleValueSchema>): boolean => value === "1" || value === "true")
	.optional();

/** On/off switch whose unset value is `false` (features are opt-in). */
export const ToggleEnvSchema = OptionalToggleEnvSchema.transform((value: boolean | undefined): boolean => value ?? false);

// ── Secrets ────────────────────────────────────────────────────────────────

/** Minimum length for an HMAC / JWT signing secret. */
export const MIN_SECRET_LENGTH = 32;

/** The placeholder shipped in `.env.example` files — never a real secret. */
const PLACEHOLDER_SECRET_PATTERN = /change-me/i;

const GENERATE_SECRETS_HINT = "generate one with: pnpm secrets:generate apps/api/.env";

/**
 * A signing secret: at least {@link MIN_SECRET_LENGTH} characters and not
 * the documented placeholder. There is deliberately NO default anywhere —
 * a missing secret stops the API from booting in every environment.
 */
export const SecretEnvSchema = z
	.string()
	.min(MIN_SECRET_LENGTH, `must be at least ${String(MIN_SECRET_LENGTH)} characters (${GENERATE_SECRETS_HINT})`)
	.refine((value: string): boolean => !PLACEHOLDER_SECRET_PATTERN.test(value), {
		error: `is still the .env.example placeholder (${GENERATE_SECRETS_HINT})`,
	});

/** AES-256 needs exactly 32 bytes of key material. */
export const AES_256_KEY_BYTES = 32;

/** Standard base64 that decodes to exactly {@link AES_256_KEY_BYTES} bytes (`openssl rand -base64 32`). */
export const Aes256KeyEnvSchema = z
	.base64({ error: "must be standard base64 (generate with: openssl rand -base64 32)" })
	.refine((value: string): boolean => Buffer.from(value, "base64").length === AES_256_KEY_BYTES, {
		error: `must decode to exactly ${String(AES_256_KEY_BYTES)} bytes (generate with: openssl rand -base64 32)`,
	});

const KEY_VERSION_PATTERN = /^[1-9]\d*$/;

function isJsonText(raw: string): boolean {
	try {
		JSON.parse(raw);
		return true;
	} catch {
		return false;
	}
}

function parseJsonText(raw: string): JsonValue {
	return JsonValueSchema.parse(JSON.parse(raw));
}

/**
 * `MFA_ENCRYPTION_KEYS`: JSON object mapping a positive key version to
 * base64 AES-256 key material, e.g. `{"1":"<openssl rand -base64 32>"}`.
 * The highest version encrypts; older versions stay for decryption.
 */
export const MfaEncryptionKeysEnvSchema = z
	.string()
	.refine(isJsonText, { error: 'must be a JSON object such as {"1":"<base64 key>"}' })
	.transform(parseJsonText)
	.pipe(
		z
			.record(z.string().regex(KEY_VERSION_PATTERN, "key versions must be positive integers"), Aes256KeyEnvSchema)
			.refine((keys: Record<string, string>): boolean => Object.keys(keys).length > 0, { error: "must contain at least one key version" }),
	)
	.transform((keys: Record<string, string>): Readonly<Record<number, string>> => Object.fromEntries(Object.entries(keys)));

/**
 * `TENANT_ENCRYPTION_PREVIOUS_MASTER_KEYS`: retired tenant key-encryption keys
 * that may still unwrap data keys until `pnpm db:rewrap-tenant-keys` moves
 * them to the current version — same JSON shape as `MFA_ENCRYPTION_KEYS`.
 */
export const RetiredTenantMasterKeysEnvSchema = MfaEncryptionKeysEnvSchema;

/**
 * `REWARD_CODE_HASH_KEYS`: HMAC-SHA256 key ring for reward QR tokens and
 * backup codes — same JSON shape as `MFA_ENCRYPTION_KEYS` (version → base64 of
 * 32 bytes). The highest version hashes new codes; every version is tried on
 * lookup, so a rotation never invalidates codes already issued.
 */
export const RewardCodeHashKeysEnvSchema = MfaEncryptionKeysEnvSchema;

/**
 * Key-management provider that wraps tenant data keys. `local` keeps the KEK
 * in the environment (development / self-hosted); a managed KMS provider is
 * added here together with its adapter.
 */
export const TenantKmsProviderSchema = z.enum(["local"]);
export type TenantKmsProvider = z.output<typeof TenantKmsProviderSchema>;

// ── Formats ────────────────────────────────────────────────────────────────

const JWT_EXPIRY_PATTERN = /^[1-9]\d*[smhd]?$/;

/** Token lifetime understood by `common/utils/expiry.ts`: `<n>` minutes or `<n>s|m|h|d`. */
export function jwtExpiryEnvSchema(defaultValue: string): z.ZodType<string, string | undefined> {
	return z.string().trim().regex(JWT_EXPIRY_PATTERN, 'must be a positive duration such as "15m", "12h" or "7d"').default(defaultValue);
}

/** `CORS_ORIGINS`: comma-separated absolute http(s) origins (at least one). */
export const CorsOriginsEnvSchema = commaSeparatedEnvSchema(HttpUrlEnvSchema);

/** Levels pino accepts for Fastify's request logger (and Prisma's debug switch). */
export const LogLevelSchema = z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]);
export type LogLevel = z.output<typeof LogLevelSchema>;

/** Delivery mode of the email sender. */
export const EmailModeSchema = z.enum(["send", "log-only", "noop"]);
export type EmailMode = z.output<typeof EmailModeSchema>;

/**
 * When a password login must also pass the emailed one-time code:
 * - `new-device` — only from a device not verified in the last week (default);
 * - `always`     — on every login (ignores the trusted-device cache);
 * - `disabled`   — never. Rejected in production; exists so automated test
 *                  runs can log in without an inbox.
 */
export const LoginVerificationModeSchema = z.enum(["new-device", "always", "disabled"]);
export type LoginVerificationMode = z.output<typeof LoginVerificationModeSchema>;

/**
 * BullMQ key prefix (`BULLMQ_PREFIX`): every queue AND worker key lives under
 * `<prefix>:<queue>:…`. Separate prefixes on one Redis are fully isolated
 * (an e2e run never steals a running dev API's jobs). Redis-key safe: starts
 * with a letter or digit, then letters, digits, `:`, `_`, `-`; at most 64 chars.
 */
export const BullMqPrefixEnvSchema = z
	.string()
	.trim()
	.regex(/^[A-Za-z0-9][A-Za-z0-9:_-]{0,63}$/, "must be 1–64 characters: letters, digits, ':', '_' or '-' (starting with a letter or digit)");

/**
 * Redis namespace (`REDIS_NAMESPACE`): every raw Redis key and pub/sub channel
 * the API uses (authorization invalidation channel, user-session cache,
 * throttler, login verification, email rate limits) lives under
 * `<namespace>:…` (see infrastructure/redis/redis-namespace.ts). Two APIs on
 * one Redis with different namespaces never read each other's keys or
 * messages. Same character rules as BULLMQ_PREFIX.
 */
export const RedisNamespaceEnvSchema = BullMqPrefixEnvSchema;

/** Backend for the authorization / user-session caches. `auto` = redis outside development when REDIS_URL is set. */
export const CacheBackendSettingSchema = z.enum(["memory", "redis", "auto"]);
export type CacheBackendSetting = z.output<typeof CacheBackendSettingSchema>;

/** Resolved cache backend. */
export type CacheBackend = Exclude<CacheBackendSetting, "auto">;

/** Object storage provider. */
export const StorageProviderSettingSchema = z.enum(["local", "s3", "firebase"]);
export type StorageProviderSetting = z.output<typeof StorageProviderSettingSchema>;

/**
 * Malware scanner uploaded files pass through before they become READY.
 * - `none` — no scanner is configured. Uploads still get every byte check
 *            (size, SHA-256, magic bytes) and then become READY with scan status
 *            NOT_SCANNED — recorded on the file, shown in the API, logged at boot.
 *            Never reported as CLEAN.
 * A real scanner (e.g. AWS GuardDuty Malware Protection, verdicts posted to
 * POST /files/processing-callback) is added as one more value + one adapter.
 * There is deliberately no default: an environment must choose explicitly.
 */
export const MalwareScannerSettingSchema = z.enum(["none"]);
export type MalwareScannerSetting = z.output<typeof MalwareScannerSettingSchema>;

const REDIS_PROTOCOL_PATTERN = /^rediss?$/;
const AMQP_PROTOCOL_PATTERN = /^amqps?$/;

/** `redis://` / `rediss://` connection URL. */
export const RedisUrlEnvSchema = z.url({ protocol: REDIS_PROTOCOL_PATTERN, error: "must be a redis:// or rediss:// URL" });

/** `amqp://` / `amqps://` connection URL. */
export const AmqpUrlEnvSchema = z.url({ protocol: AMQP_PROTOCOL_PATTERN, error: "must be an amqp:// or amqps:// URL" });

/** A non-empty identifier such as a bucket name or a service id. */
export const NonEmptyEnvStringSchema = z.string().trim().min(1, "must not be empty");

/**
 * Bare host name of the CDN that serves public assets (`d123abc.cloudfront.net`
 * or a custom domain such as `cdn.example.com`). The API builds
 * `https://<host>/<key>` from it, so a scheme, port or path is rejected.
 */
export const CdnHostEnvSchema = z
	.string()
	.trim()
	.toLowerCase()
	.pipe(z.hostname({ error: "must be a bare host name such as d123abc.cloudfront.net (no https://, port or path)" }));

/** CloudFront distribution ids are upper-case alphanumerics (e.g. `E2QWRUHAPOMQZL`). */
const CLOUDFRONT_DISTRIBUTION_ID_PATTERN = /^[A-Z0-9]{10,20}$/;

/** Id of the CloudFront distribution in front of the public-origin bucket (stack output `CloudFrontDistributionId`). */
export const CloudFrontDistributionIdEnvSchema = z
	.string()
	.trim()
	.regex(CLOUDFRONT_DISTRIBUTION_ID_PATTERN, "must be a CloudFront distribution id such as E2QWRUHAPOMQZL (the CloudFrontDistributionId stack output)");
