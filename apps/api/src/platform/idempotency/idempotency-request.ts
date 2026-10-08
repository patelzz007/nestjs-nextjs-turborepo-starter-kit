import { createHash } from "node:crypto";

import { ApiErrorCodes, IDEMPOTENCY_KEY_HEADER, isArrayValue, isJsonPrimitive, type JsonValue } from "@workspace/shared";
import { z } from "zod";

import type { RequestContext } from "../../common/context/request-context";
import { ValidationError } from "../../common/errors/app-error";
import { IDEMPOTENCY_SCOPE_MAX_LENGTH } from "./idempotency.constants";
import { IdempotencyPrincipalRequiredError, IdempotencyUnsupportedContentTypeError } from "./idempotency.errors";

/** Key length bounds — long enough for a UUID/ULID, bounded to the `VarChar(128)` column. */
const IDEMPOTENCY_KEY_MIN_LENGTH = 8;
const IDEMPOTENCY_KEY_MAX_LENGTH = 128;

/** Placeholder for an absent tenant component in a scope (never a valid id). */
const NO_TENANT_COMPONENT = "-";

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
	if (isJsonPrimitive(value)) {
		return JSON.stringify(value);
	}
	if (isArrayValue(value)) {
		return `[${value.map((item: JsonValue): string => canonicalJson(item)).join(",")}]`;
	}
	const entries: string[] = Object.keys(value)
		.sort()
		.map((key: string): string => `${JSON.stringify(key)}:${canonicalJson(value[key] ?? null)}`);
	return `{${entries.join(",")}}`;
}

/** The request body as far as idempotency is concerned: absent, or canonical JSON. */
export type IdempotentRequestBody = { readonly kind: "none" } | { readonly kind: "json"; readonly value: JsonValue };

/** What identifies "the same request" for idempotency purposes. */
export interface IdempotentRequestFingerprint {
	readonly method: string;
	/** Concrete request URL including path parameters and query string. */
	readonly url: string;
	readonly body: IdempotentRequestBody;
}

/** SHA-256 (hex) of the canonical request fingerprint — stored, compared, never reversed. */
export function hashIdempotentRequest(fingerprint: IdempotentRequestFingerprint): string {
	const body: JsonValue = fingerprint.body.kind === "none" ? { kind: "none" } : { kind: "json", value: fingerprint.body.value };
	const canonical: string = canonicalJson({ method: fingerprint.method.toUpperCase(), url: fingerprint.url, body });
	return createHash("sha256").update(canonical).digest("hex");
}

/** `application/json` or a `+json` structured syntax suffix, ignoring parameters (`; charset=utf-8`). */
const JSON_MEDIA_TYPE = /^application\/(?:[a-z0-9.+-]+\+)?json$/;

/** A request body after the JSON boundary check (parsed once, by the caller, with `JsonValueSchema`). */
export type ParsedRequestBody = { readonly kind: "absent" } | { readonly kind: "json"; readonly value: JsonValue } | { readonly kind: "not_json" };

/** The parts of a request the body fingerprint needs. */
export interface IdempotentRequestBodySource {
	readonly contentType: string | undefined;
	readonly body: ParsedRequestBody;
}

/**
 * Fingerprintable body of a request. A JSON body is canonicalized; no body is
 * `none`. Anything else (multipart uploads, form posts, raw bytes) is REFUSED
 * with 415 — it cannot be canonicalized, and treating it as "no body" would
 * make two different uploads look identical and replay the wrong response.
 */
export function readIdempotentRequestBody(source: IdempotentRequestBodySource): IdempotentRequestBody {
	const [rawMediaType] = source.contentType?.split(";") ?? [];
	const mediaType: string | undefined = rawMediaType?.trim().toLowerCase();
	if (mediaType !== undefined && mediaType.length > 0 && !JSON_MEDIA_TYPE.test(mediaType)) {
		throw new IdempotencyUnsupportedContentTypeError();
	}
	switch (source.body.kind) {
		case "absent":
			return { kind: "none" };
		case "json":
			return { kind: "json", value: source.body.value };
		case "not_json":
			throw new IdempotencyUnsupportedContentTypeError();
	}
}

/**
 * The namespace a key lives in: WHO is calling, for WHICH tenant, on WHICH
 * endpoint. All three come from the server-verified request context (ADR 017)
 * — never from raw headers — so one caller can never replay another caller's
 * response, nor the same caller's response from another organization/store.
 *
 * - user principal → `user:<id>` (plus `:as:<impersonator>` while impersonating)
 * - API-key principal (POS / `@AllowApiKeyAuth()`) → `key:<apiKeyId>`
 * - tenant → the verified organization / store / location (API keys: the key's organization)
 *
 * Over-long scopes are hashed to fit the `VarChar(200)` column.
 */
export function buildIdempotencyScope(context: RequestContext | undefined, method: string, routeTemplate: string): string {
	const principal: string = describePrincipal(context);
	const tenant: string = describeTenant(context);
	const scope = `http:${principal}|${tenant}|${method.toUpperCase()} ${routeTemplate}`;
	if (scope.length <= IDEMPOTENCY_SCOPE_MAX_LENGTH) {
		return scope;
	}
	return `http:sha256:${createHash("sha256").update(scope).digest("hex")}`;
}

function describePrincipal(context: RequestContext | undefined): string {
	const user = context?.principal;
	if (user !== undefined) {
		return user.impersonatorId === undefined ? `user:${user.userId}` : `user:${user.userId}:as:${user.impersonatorId}`;
	}
	const apiKey = context?.apiKey;
	if (apiKey !== undefined) {
		return `key:${apiKey.apiKeyId}`;
	}
	// An anonymous key namespace would let one client replay another client's response.
	throw new IdempotencyPrincipalRequiredError();
}

function describeTenant(context: RequestContext | undefined): string {
	const tenant = context?.tenant;
	const organizationId: string | undefined = tenant?.organizationId ?? context?.apiKey?.organizationId;
	return [`org:${organizationId ?? NO_TENANT_COMPONENT}`, `store:${tenant?.storeId ?? NO_TENANT_COMPONENT}`, `loc:${tenant?.locationId ?? NO_TENANT_COMPONENT}`].join(":");
}
