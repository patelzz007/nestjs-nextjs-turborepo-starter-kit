import { createHash } from "node:crypto";

import { ApiErrorCodes, type JsonValue } from "@workspace/shared";
import { z } from "zod";

import { ValidationError } from "../../common/errors/app-error";
import { IDEMPOTENCY_KEY_HEADER, IDEMPOTENCY_SCOPE_MAX_LENGTH } from "./idempotency.constants";

/** Key length bounds — long enough for a UUID/ULID, bounded to the `VarChar(128)` column. */
const IDEMPOTENCY_KEY_MIN_LENGTH = 8;
const IDEMPOTENCY_KEY_MAX_LENGTH = 128;

/**
 * Client-generated idempotency key. Opaque to the server; a UUIDv4/ULID is
 * the recommended value. Restricted to URL-safe characters so it can never
 * smuggle separators into the stored scope or a log line.
 */
export const IdempotencyKeySchema = z
	.string()
	.trim()
	.min(IDEMPOTENCY_KEY_MIN_LENGTH)
	.max(IDEMPOTENCY_KEY_MAX_LENGTH)
	.regex(/^[A-Za-z0-9._:-]+$/);

export type IdempotencyKey = z.output<typeof IdempotencyKeySchema>;

/**
 * Parse the raw header value. `undefined` when absent; throws a 400
 * `VALIDATION_ERROR` when present but malformed (or sent more than once).
 */
export function parseIdempotencyKeyHeader(raw: string | readonly string[] | undefined): IdempotencyKey | undefined {
	if (raw === undefined) {
		return undefined;
	}
	const single = z.string().safeParse(raw);
	const parsed = single.success ? IdempotencyKeySchema.safeParse(single.data) : undefined;
	if (parsed?.success !== true) {
		throw new ValidationError({
			message: `${IDEMPOTENCY_KEY_HEADER} must be a single value of ${String(IDEMPOTENCY_KEY_MIN_LENGTH)}-${String(IDEMPOTENCY_KEY_MAX_LENGTH)} characters from [A-Za-z0-9._:-].`,
			details: { issues: [{ path: IDEMPOTENCY_KEY_HEADER, message: "Invalid idempotency key", code: ApiErrorCodes.VALIDATION_ERROR }] },
		});
	}
	return parsed.data;
}

/**
 * Deterministic JSON serialization: object keys sorted recursively so two
 * semantically identical payloads (`{a,b}` vs `{b,a}`) hash identically.
 */
export function canonicalJson(value: JsonValue): string {
	if (value === null || typeof value !== "object") {
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) {
		return `[${value.map((item: JsonValue): string => canonicalJson(item)).join(",")}]`;
	}
	const entries: string[] = Object.keys(value)
		.sort()
		.map((key: string): string => `${JSON.stringify(key)}:${canonicalJson(value[key] ?? null)}`);
	return `{${entries.join(",")}}`;
}

/** What identifies "the same request" for idempotency purposes. */
export interface IdempotentRequestFingerprint {
	readonly method: string;
	/** Concrete request URL including path parameters and query string. */
	readonly url: string;
	readonly body: JsonValue;
}

/** SHA-256 (hex) of the canonical request fingerprint — stored, compared, never reversed. */
export function hashIdempotentRequest(fingerprint: IdempotentRequestFingerprint): string {
	const canonical: string = canonicalJson({ method: fingerprint.method.toUpperCase(), url: fingerprint.url, body: fingerprint.body });
	return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Namespace for a key: the authenticated principal plus the route TEMPLATE.
 * Keys are per-caller (one user can never replay another user's response)
 * and per-endpoint. Over-long scopes are hashed to fit the column.
 */
export function buildIdempotencyScope(principalId: string, method: string, routeTemplate: string): string {
	const scope = `http:${principalId}:${method.toUpperCase()} ${routeTemplate}`;
	if (scope.length <= IDEMPOTENCY_SCOPE_MAX_LENGTH) {
		return scope;
	}
	return `http:${principalId}:sha256:${createHash("sha256").update(`${method.toUpperCase()} ${routeTemplate}`).digest("hex")}`;
}
