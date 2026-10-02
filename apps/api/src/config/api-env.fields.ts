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

/** Backend for the authorization / user-session caches. `auto` = redis outside development when REDIS_URL is set. */
export const CacheBackendSettingSchema = z.enum(["memory", "redis", "auto"]);
export type CacheBackendSetting = z.output<typeof CacheBackendSettingSchema>;

/** Resolved cache backend. */
export type CacheBackend = Exclude<CacheBackendSetting, "auto">;

/** Object storage provider. */
export const StorageProviderSettingSchema = z.enum(["local", "s3", "firebase"]);
export type StorageProviderSetting = z.output<typeof StorageProviderSettingSchema>;

const REDIS_PROTOCOL_PATTERN = /^rediss?$/;
const AMQP_PROTOCOL_PATTERN = /^amqps?$/;

/** `redis://` / `rediss://` connection URL. */
export const RedisUrlEnvSchema = z.url({ protocol: REDIS_PROTOCOL_PATTERN, error: "must be a redis:// or rediss:// URL" });

/** `amqp://` / `amqps://` connection URL. */
export const AmqpUrlEnvSchema = z.url({ protocol: AMQP_PROTOCOL_PATTERN, error: "must be an amqp:// or amqps:// URL" });

/** A non-empty identifier such as a bucket name or a service id. */
export const NonEmptyEnvStringSchema = z.string().trim().min(1, "must not be empty");
