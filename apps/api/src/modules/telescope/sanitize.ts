import { StringValueSchema, TelescopeJsonObjectSchema, TelescopeJsonScalarSchema, TelescopeJsonValueSchema, type TelescopeJsonValue } from "@workspace/shared";

/**
 * Keys that are ALWAYS stripped from stored data — even when explicitly
 * whitelisted (docs/telescope.md §10.2). Credentials can never be captured.
 */
const REDACT_KEY_PATTERN = /password|authorization|set-cookie|cookie|token|secret|api[_-]?key|credential/i;

/** Masks the local part of an email: `alice.wong@x.com` → `a***@x.com`. */
const EMAIL_MASK_PATTERN = /([a-zA-Z0-9._%+-])[^@\s]{1,24}@/g;

const REDACTED = "[REDACTED]";

/** Serialization budget applied to stored bodies (docs/telescope.md §10.4). */
export const MAX_BODY_CHARS = 2000;
/** Per-value header length cap. */
export const MAX_HEADER_VALUE_CHARS = 200;
/** Per-string length cap inside stored bodies. */
export const MAX_STRING_FIELD_CHARS = 500;

const REDACT_KEY_PATTERN_FOR_KEY: (key: string) => boolean = (key) => REDACT_KEY_PATTERN.test(key);

function isString(value: TelescopeJsonValue): value is string {
	return StringValueSchema.safeParse(value).success;
}

function isScalar(value: TelescopeJsonValue): boolean {
	return TelescopeJsonScalarSchema.safeParse(value).success;
}

function isObject(value: TelescopeJsonValue): value is Record<string, TelescopeJsonValue> {
	return TelescopeJsonObjectSchema.safeParse(value).success;
}

/**
 * Recursively sanitizes a JSON value: redacts secret-looking keys, masks
 * emails inside strings, truncates over-long strings. Depth-capped so a
 * pathological nesting can't recurse forever.
 */
export function sanitizeJson(value: TelescopeJsonValue, depth = 0): TelescopeJsonValue {
	if (isScalar(value)) {
		return value;
	}
	if (isString(value)) {
		const masked: string = value.replace(EMAIL_MASK_PATTERN, "$1***@");
		return masked.length > MAX_STRING_FIELD_CHARS ? `${masked.slice(0, MAX_STRING_FIELD_CHARS)}…` : masked;
	}
	if (Array.isArray(value)) {
		if (depth > 6) {
			return "[…]";
		}
		return value.map((item: TelescopeJsonValue): TelescopeJsonValue => sanitizeJson(item, depth + 1));
	}
	if (isObject(value)) {
		if (depth > 6) {
			return { truncated: "[…]" };
		}
		const record: Record<string, TelescopeJsonValue> = {};
		for (const [key, item] of Object.entries(value)) {
			const redact: boolean = REDACT_KEY_PATTERN_FOR_KEY(key);
			record[key] = redact ? REDACTED : sanitizeJson(item, depth + 1);
		}
		return record;
	}
	return value;
}

/**
 * Truncates a sanitized JSON value to the body budget. If serialization +
 * slicing lands mid-string, falls back to a stable `{ truncated, preview }`
 * marker so the stored value always parses as JSON.
 *
 * Improvement 10: the budget is a parameter (defaults to the module constant)
 * so `TELESCOPE_BODY_LIMIT_CHARS` can raise/lower it per deployment.
 */
export function truncateJson(value: TelescopeJsonValue, maxChars: number = MAX_BODY_CHARS): TelescopeJsonValue {
	const serialized: string = JSON.stringify(value);
	if (serialized.length <= maxChars) {
		return value;
	}
	const preview: string = serialized.slice(0, maxChars);
	try {
		const parsed = TelescopeJsonValueSchema.safeParse(JSON.parse(preview));
		return parsed.success ? parsed.data : { truncated: true, preview: `${preview}…` };
	} catch {
		return { truncated: true, preview: `${preview}…` };
	}
}

/**
 * Picks only the whitelisted headers from a Node `IncomingHttpHeaders` map,
 * then applies the immutable denylist on top (defense in depth — a
 * whitelisted header can never be a credential). Values are capped in length.
 */
export function sanitizeHeaders(headers: Readonly<Record<string, string | string[] | undefined>>, whitelist: readonly string[]): Record<string, string> | null {
	const picked: Record<string, string> = {};
	for (const name of whitelist) {
		const raw: string | string[] | undefined = headers[name.toLowerCase()];
		if (raw === undefined || REDACT_KEY_PATTERN_FOR_KEY(name)) {
			continue;
		}
		const value: string = Array.isArray(raw) ? raw.join(", ") : raw;
		picked[name] = value.length > MAX_HEADER_VALUE_CHARS ? `${value.slice(0, MAX_HEADER_VALUE_CHARS)}…` : value;
	}
	return Object.keys(picked).length > 0 ? picked : null;
}

/**
 * Sanitizes Prisma's query-event params JSON string (bind values contain user
 * data — emails, names — and must be masked before storage).
 */
export function sanitizeQueryParams(params: string): string | null {
	if (params.length === 0) {
		return null;
	}
	const masked: string = params.replace(EMAIL_MASK_PATTERN, "$1***@");
	return masked.length > MAX_BODY_CHARS ? `${masked.slice(0, MAX_BODY_CHARS)}…` : masked;
}
