import { isArrayValue, isJsonPrimitive, type DataValue } from "@workspace/shared";

// ── Centralized secret redaction (docs/technical/operations/observability.md → "Redaction") ─────────
//
// ONE list of sensitive field names, applied to:
//   1. pino (Fastify's logger) via `PINO_REDACT_PATHS`
//   2. `LogService` structured metadata via `redactSecrets()`
//   3. URLs written to log lines via `redactUrl()` (query-string secrets)
//
// Add a field here and every sink picks it up. Never log a value first and
// "clean it up later" — redaction happens before the value reaches a sink.

/** Replacement written in place of every sensitive value. */
export const REDACTED = "[REDACTED]";

/** Replacement for a reference back to an ancestor object (cyclic structures). */
export const CIRCULAR = "[CIRCULAR]";

/**
 * Field names whose VALUE is always secret, matched case-insensitively and
 * ignoring `-`/`_` separators (`Set-Cookie`, `set_cookie`, `setCookie` all
 * match `set-cookie`).
 *
 * `code` is intentionally on the list: it is the field name used for 2FA /
 * email OTP codes in request bodies. Machine error codes must therefore be
 * logged under `errorCode`, never `code`.
 */
export const SENSITIVE_FIELD_NAMES: readonly string[] = [
	// Credentials
	"password",
	"newPassword",
	"currentPassword",
	"confirmPassword",
	"oldPassword",
	"passwordConfirmation",
	// Tokens & keys
	"token",
	"accessToken",
	"refreshToken",
	"idToken",
	"sessionToken",
	"csrfToken",
	"secret",
	"clientSecret",
	"apiKey",
	"privateKey",
	// Transport credentials
	"authorization",
	"proxy-authorization",
	"cookie",
	"set-cookie",
	"x-api-key",
	// One-time codes / MFA
	"otp",
	"code",
	"totp",
	"totpCode",
	"otpCode",
	"mfaCode",
	"twoFactorCode",
	"verificationCode",
	"recoveryCode",
	"recoveryCodes",
	"backupCode",
	"backupCodes",
	// 2FA enrollment: both carry the TOTP secret (the key URI in its query, the QR code as an image of it)
	"otpAuthUrl",
	"qrCodeDataUrl",
	// Device pairing (POS terminal pairing codes are bearer credentials)
	"pairingCode",
	// Payment data
	"card",
	"cardNumber",
	"cvc",
	"cvv",
	"iban",
	"accountNumber",
];

/**
 * Normalized suffixes that mark a compound field as secret even when it is
 * not listed verbatim (`resetToken`, `jwtSecret`, `stripeApiKey`,
 * `userPassword`, `emailOtp`). Kept to unambiguous words — a suffix such as
 * `code` would also swallow `countryCode` / `errorCode`.
 */
const SENSITIVE_SUFFIXES: readonly string[] = ["password", "secret", "token", "apikey", "privatekey", "otp", "cvv", "cvc", "cardnumber", "accountnumber", "pairingcode"];

/** Lowercase and drop every non-alphanumeric character. */
function normalizeFieldName(key: string): string {
	return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const NORMALIZED_SENSITIVE_NAMES: ReadonlySet<string> = new Set<string>(SENSITIVE_FIELD_NAMES.map(normalizeFieldName));

/** True when a field with this name must never have its value logged. */
export function isSensitiveFieldName(key: string): boolean {
	const normalized: string = normalizeFieldName(key);
	if (normalized.length === 0) {
		return false;
	}
	if (NORMALIZED_SENSITIVE_NAMES.has(normalized)) {
		return true;
	}
	return SENSITIVE_SUFFIXES.some((suffix: string): boolean => normalized.endsWith(suffix));
}

function redactNode(value: DataValue | undefined, ancestors: Set<DataValue>): DataValue | undefined {
	if (value === null || value === undefined || isJsonPrimitive(value)) {
		return value;
	}
	if (ancestors.has(value)) {
		return CIRCULAR;
	}
	ancestors.add(value);
	try {
		if (isArrayValue(value)) {
			return value.map((item: DataValue): DataValue => redactNode(item, ancestors) ?? null);
		}
		const result: Record<string, DataValue | undefined> = {};
		for (const [key, child] of Object.entries(value)) {
			result[key] = isSensitiveFieldName(key) ? REDACTED : redactNode(child, ancestors);
		}
		return result;
	} finally {
		ancestors.delete(value);
	}
}

/**
 * Deep-clone `value`, replacing the value of every sensitive field (at any
 * depth, inside arrays too) with `"[REDACTED]"`. The input is never mutated.
 * A reference back to an ancestor becomes `"[CIRCULAR]"` instead of
 * recursing forever; shared (non-cyclic) references are cloned normally.
 */
export function redactSecrets(value: DataValue): DataValue {
	return redactNode(value, new Set<DataValue>()) ?? null;
}

/**
 * Redact sensitive query-string parameters (`?token=…&page=2` →
 * `?token=[REDACTED]&page=2`). The path and non-sensitive parameters are
 * left byte-for-byte intact so log lines stay greppable.
 */
export function redactUrl(url: string): string {
	const queryStart: number = url.indexOf("?");
	if (queryStart === -1) {
		return url;
	}
	const path: string = url.slice(0, queryStart);
	const query: string = url.slice(queryStart + 1);
	const redactedPairs: string[] = query.split("&").map((pair: string): string => {
		const separatorIndex: number = pair.indexOf("=");
		const rawKey: string = separatorIndex === -1 ? pair : pair.slice(0, separatorIndex);
		return isSensitiveFieldName(safeDecodeUriComponent(rawKey)) ? `${rawKey}=${REDACTED}` : pair;
	});
	return `${path}?${redactedPairs.join("&")}`;
}

function safeDecodeUriComponent(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		// Malformed escape sequence — match on the raw text instead.
		return value;
	}
}

/** Depth (below the logged object's root) up to which pino redacts a sensitive field by wildcard. */
const PINO_WILDCARD_DEPTH = 3;

/** Render a field name as a fast-redact path segment (`password` or `["set-cookie"]`). */
function pinoSegment(key: string, isFirst: boolean): string {
	if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) {
		return isFirst ? key : `.${key}`;
	}
	return `["${key}"]`;
}

/**
 * Redaction paths for pino / Fastify's logger, derived from
 * {@link SENSITIVE_FIELD_NAMES}. fast-redact (pino's engine) matches exact,
 * case-sensitive paths with `*` wildcards — it cannot do "any depth" or
 * case-insensitive matching — so this covers:
 * - request/response headers (Node lowercases incoming header names)
 * - each field at the root and up to {@link PINO_WILDCARD_DEPTH} levels deep
 *
 * Structured metadata that goes through `LogService` gets the stronger,
 * any-depth, case-insensitive {@link redactSecrets} instead.
 */
export function buildPinoRedactPaths(): string[] {
	const paths: string[] = [];
	for (const field of SENSITIVE_FIELD_NAMES) {
		const header: string = field.toLowerCase();
		paths.push(`req.headers${pinoSegment(header, false)}`, `res.headers${pinoSegment(header, false)}`);
		let prefix = "";
		for (let depth = 0; depth <= PINO_WILDCARD_DEPTH; depth += 1) {
			paths.push(`${prefix}${pinoSegment(field, prefix.length === 0)}`);
			prefix = prefix.length === 0 ? "*" : `${prefix}.*`;
		}
	}
	return [...new Set<string>(paths)];
}
