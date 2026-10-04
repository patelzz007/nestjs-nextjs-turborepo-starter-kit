// ============================================
// common/audit/http-audit-entry.ts — what ONE global audit row contains
// ============================================
// Pure functions: request + request context (ADR 017) + outcome → the row
// written to `audit_logs`. Every free-form payload (route params, query,
// request body, response body) is redacted (secrets → `[REDACTED]`, personal
// data → masked) and size-capped BEFORE it leaves this file.

import { HttpStatus } from "@nestjs/common";
import { JsonValueSchema, type JsonValue } from "@workspace/shared";
import type { FastifyRequest } from "fastify";
import { z } from "zod";

import type { RequestContext } from "../context/request-context";
import { redactSecrets, redactUrl } from "../logging/redaction";
import { readFirstHeader } from "../utils/http-headers";
import { parsePreSerializationValue, serializePreSerializationValue, type PreSerializationPayload } from "../utils/serialize-pre-serialization-value";

/** HTTP methods that change state — every one of them is audited (rules/10). */
export const AUDITED_HTTP_METHODS: ReadonlySet<string> = new Set<string>(["POST", "PUT", "PATCH", "DELETE"]);

/** Largest serialized payload (UTF-8 bytes) stored per JSON column; larger ones become a truncation marker. */
export const AUDIT_PAYLOAD_MAX_BYTES = 16_384;

/** Column budgets (prisma/schema.prisma `AuditLog`). */
const AUDIT_PATH_MAX_LENGTH = 2_048;
const AUDIT_ENDPOINT_MAX_LENGTH = 512;
const AUDIT_IP_MAX_LENGTH = 64;
const AUDIT_USER_AGENT_MAX_LENGTH = 512;

/** Endpoint recorded when Fastify matched no route (unknown path → 404). */
export const UNMATCHED_ENDPOINT = "(unmatched)";

/** Replacement for a personal-data value in an audit payload. */
export const PII_MASK = "[PII]";

/**
 * Personal-data field names (matched case-insensitively, ignoring `-`/`_`).
 * The actor is identified by id; payload copies of personal data are masked
 * (rules/10 → "keep PII in them redacted or tokenized from the start").
 * Email addresses keep their first character and domain so an investigator
 * can still tell two invitations apart.
 */
const PII_FIELD_NAMES: ReadonlySet<string> = new Set<string>([
	"email",
	"contactemail",
	"phone",
	"phonenumber",
	"mobile",
	"fullname",
	"firstname",
	"lastname",
	"address",
	"addressline1",
	"addressline2",
	"dateofbirth",
	"nric",
	"passportnumber",
	"nationalid",
]);

const EMAIL_FIELD_NAMES: ReadonlySet<string> = new Set<string>(["email", "contactemail"]);

const EmailSchema = z.email();

export const AuditOutcomeSchema = z.enum(["SUCCEEDED", "FAILED"]);
export type AuditOutcome = z.output<typeof AuditOutcomeSchema>;

/** One complete audit row (mirrors the `AuditLog` model). */
export interface HttpAuditEntry {
	readonly correlationId: string;
	readonly occurredAt: number;
	readonly completedAt: number;
	readonly method: string;
	readonly endpoint: string;
	readonly path: string;
	readonly outcome: AuditOutcome;
	readonly responseStatus: number;
	readonly errorCode: string | null;
	readonly actorUserId: string | null;
	readonly impersonatorUserId: string | null;
	readonly apiKeyId: string | null;
	readonly terminalId: string | null;
	readonly organizationId: string | null;
	readonly storeId: string | null;
	readonly locationId: string | null;
	readonly ipAddress: string | null;
	readonly userAgent: string | null;
	readonly requestParams: JsonValue | null;
	readonly requestBody: JsonValue | null;
	readonly responseBody: JsonValue | null;
	readonly systemOperations: readonly string[];
}

/** How the request ended, as far as the audit row is concerned. */
export type HttpAuditOutcome =
	| { readonly outcome: "SUCCEEDED"; readonly status: number; readonly responseBody: PreSerializationPayload }
	| { readonly outcome: "FAILED"; readonly status: number; readonly errorCode: string; readonly responseBody: JsonValue };

/** True for methods whose requests must produce an audit row. */
export function isAuditedMethod(method: string): boolean {
	return AUDITED_HTTP_METHODS.has(method.toUpperCase());
}

/** The default success status Nest uses when a route declares none (`@HttpCode`). */
export function defaultSuccessStatus(method: string): number {
	return method.toUpperCase() === "POST" ? HttpStatus.CREATED : HttpStatus.OK;
}

function normalizeFieldName(key: string): string {
	return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function maskEmail(value: string): string {
	const at: number = value.lastIndexOf("@");
	return `${value.slice(0, 1)}***${value.slice(at)}`;
}

function maskPersonalData(value: JsonValue): JsonValue {
	if (value === null || typeof value !== "object") {
		return value;
	}
	if (Array.isArray(value)) {
		return value.map((item: JsonValue): JsonValue => maskPersonalData(item));
	}
	const entries: [string, JsonValue][] = Object.entries(value).flatMap(([key, child]): [string, JsonValue][] => {
		const normalized: string = normalizeFieldName(key);
		if (!PII_FIELD_NAMES.has(normalized) || child === null) {
			return [[key, maskPersonalData(child)]];
		}
		const email = EMAIL_FIELD_NAMES.has(normalized) ? EmailSchema.safeParse(child) : undefined;
		return [[key, email?.success === true ? maskEmail(email.data) : PII_MASK]];
	});
	return Object.fromEntries(entries);
}

/**
 * Redact secrets, mask personal data and cap the size of one audit payload.
 * `null` stays `null` (column NULL); an oversized payload is replaced by a
 * `{ truncated, originalBytes }` marker rather than cut mid-structure.
 */
export function toAuditPayload(value: JsonValue | null): JsonValue | null {
	if (value === null) {
		return null;
	}
	const redacted: JsonValue = JsonValueSchema.parse(maskPersonalData(JsonValueSchema.parse(redactSecrets(value))));
	const bytes: number = Buffer.byteLength(JSON.stringify(redacted), "utf8");
	if (bytes > AUDIT_PAYLOAD_MAX_BYTES) {
		return { truncated: true, originalBytes: bytes };
	}
	return redacted;
}

/** A handler result / parsed body in its wire (JSON) form; `null` when it has none. */
export function toWireJson(value: PreSerializationPayload): JsonValue | null {
	if (value === undefined) {
		return null;
	}
	const preSerialized = parsePreSerializationValue(value);
	if (preSerialized === null) {
		return null;
	}
	const json = JsonValueSchema.safeParse(serializePreSerializationValue(preSerialized));
	return json.success ? json.data : null;
}

/** `application/json` or a `+json` structured syntax suffix. */
const JSON_MEDIA_TYPE = /^application\/(?:[a-z0-9.+-]+\+)?json$/;

/** The request body as stored: JSON → redacted JSON; anything else → a marker naming its content type. */
function requestBodyPayload(request: FastifyRequest): JsonValue | null {
	if (request.body === undefined || request.body === null) {
		return null;
	}
	const contentType: string | null = readFirstHeader(request.headers["content-type"]) ?? null;
	const mediaType: string | undefined = contentType?.split(";")[0]?.trim().toLowerCase();
	const json = mediaType !== undefined && JSON_MEDIA_TYPE.test(mediaType) ? JsonValueSchema.safeParse(request.body) : undefined;
	if (json?.success === true) {
		return toAuditPayload(json.data);
	}
	// Only JSON is field-redactable: free text / form / multipart bodies could carry secrets in any shape.
	return { omitted: "non-JSON body", contentType };
}

function requestParamsPayload(request: FastifyRequest): JsonValue | null {
	const params = JsonValueSchema.safeParse(request.params ?? {});
	const query = JsonValueSchema.safeParse(request.query ?? {});
	return toAuditPayload({ params: params.success ? params.data : null, query: query.success ? query.data : null });
}

function bounded(value: string | undefined, maxLength: number): string | null {
	return value === undefined ? null : value.slice(0, maxLength);
}

/**
 * Build the complete audit row. Actor, impersonator, API key and tenant are
 * read from the request context, so they are exactly what authentication and
 * the authorization guard verified — never raw client headers.
 */
export function buildHttpAuditEntry(request: FastifyRequest, context: RequestContext, outcome: HttpAuditOutcome, completedAt: number): HttpAuditEntry {
	const responseBody: JsonValue | null = outcome.outcome === "SUCCEEDED" ? toAuditPayload(toWireJson(outcome.responseBody)) : toAuditPayload(outcome.responseBody);
	return {
		correlationId: context.correlationId,
		occurredAt: context.receivedAtEpochMs,
		completedAt,
		method: request.method.toUpperCase(),
		endpoint: (request.routeOptions.url ?? UNMATCHED_ENDPOINT).slice(0, AUDIT_ENDPOINT_MAX_LENGTH),
		path: redactUrl(request.url).slice(0, AUDIT_PATH_MAX_LENGTH),
		outcome: outcome.outcome,
		responseStatus: outcome.status,
		errorCode: outcome.outcome === "FAILED" ? outcome.errorCode : null,
		actorUserId: context.principal?.userId ?? null,
		impersonatorUserId: context.principal?.impersonatorId ?? null,
		apiKeyId: context.apiKey?.apiKeyId ?? null,
		terminalId: context.apiKey?.terminalId ?? null,
		organizationId: context.tenant.organizationId ?? context.apiKey?.organizationId ?? null,
		storeId: context.tenant.storeId ?? null,
		locationId: context.tenant.locationId ?? null,
		ipAddress: bounded(context.ip, AUDIT_IP_MAX_LENGTH),
		userAgent: bounded(context.userAgent, AUDIT_USER_AGENT_MAX_LENGTH),
		requestParams: requestParamsPayload(request),
		requestBody: requestBodyPayload(request),
		responseBody,
		systemOperations: [...context.systemOperations],
	};
}
