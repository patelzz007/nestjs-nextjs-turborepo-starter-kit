import { z } from "zod";

import { EpochMsSchema } from "../../api/common";
import { defineListQuery, listFilter, ListSearchSchema } from "../../api/list-query";
import { JsonValueSchema } from "../../runtime/json";
import { DeviceTypeSchema, IpAddressScopeSchema } from "./enums";

/**
 * Global HTTP audit trail — the admin viewer's contract (`GET /admin/audit-logs`,
 * `GET /admin/audit-logs/:id`). One record per HTTP request, reads included,
 * successful or failed — only the automated health probes are exempt
 * (docs/adr/025-global-http-audit-log.md). Payloads were redacted and
 * size-capped by the API BEFORE they were stored; this contract only exposes them.
 */

// ── Enums (mirror the Prisma enums / stored values) ─────────────────────────

/** How an audited request ended. Mirrors the Prisma enum `AuditOutcome`. */
export const AuditOutcomeSchema = z.enum(["SUCCEEDED", "FAILED"]);
export type AuditOutcome = z.output<typeof AuditOutcomeSchema>;

/** How the caller authenticated. Mirrors the Prisma enum `AuditAuthMethod`; `null` on a record = anonymous. */
export const AuditAuthMethodSchema = z.enum(["BEARER_TOKEN", "SESSION_COOKIE", "REFRESH_COOKIE", "API_KEY"]);
export type AuditAuthMethod = z.output<typeof AuditAuthMethodSchema>;

/** The standard HTTP methods the viewer filters by (a record may carry any method the client sent). */
export const AuditHttpMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
export type AuditHttpMethod = z.output<typeof AuditHttpMethodSchema>;

// ── Column budgets (apps/api/prisma/schema.prisma `AuditLog`) ───────────────

const AUDIT_ID_MAX_LENGTH = 64;
const AUDIT_METHOD_MAX_LENGTH = 10;
const AUDIT_NAME_MAX_LENGTH = 64;
const AUDIT_VERSION_MAX_LENGTH = 32;
const AUDIT_CITY_MAX_LENGTH = 128;
const COUNTRY_CODE_LENGTH = 2;
/** IP versions a record can carry. */
const IpVersionSchema = z.union([z.literal(4), z.literal(6)]);
const AUDIT_ENDPOINT_MAX_LENGTH = 512;
const AUDIT_URL_MAX_LENGTH = 2_048;
const AUDIT_ERROR_CODE_MAX_LENGTH = 64;
const AUDIT_USER_AGENT_MAX_LENGTH = 512;
const AUDIT_CLIENT_TYPE_MAX_LENGTH = 32;
const AUDIT_HTTP_VERSION_MAX_LENGTH = 8;
const AUDIT_HOST_MAX_LENGTH = 255;
const AUDIT_ORIGIN_MAX_LENGTH = 512;
const AUDIT_HEADER_MAX_LENGTH = 256;
const AUDIT_IDEMPOTENCY_KEY_MAX_LENGTH = 255;
const AUDIT_SYSTEM_OPERATION_MAX_LENGTH = 100;
/** Lowest / highest HTTP status code a record can carry. */
const HTTP_STATUS_MIN = 100;
const HTTP_STATUS_MAX = 599;

const AuditIdSchema = z.string().min(1).max(AUDIT_ID_MAX_LENGTH);

// ── Resolved references ─────────────────────────────────────────────────────

/**
 * A user named by a record (actor or impersonator). `email` / `fullName` are
 * resolved when the record is read; they are `null` when the id no longer
 * resolves to a user row — the id itself is the forensic fact.
 */
export const AuditLogUserSchema = z.object({
	id: AuditIdSchema,
	email: z.string().nullable(),
	fullName: z.string().nullable(),
});
export type AuditLogUser = z.output<typeof AuditLogUserSchema>;

/** The organization (tenant) a record is scoped to; `name` is `null` when the id no longer resolves. */
export const AuditLogOrganizationSchema = z.object({
	id: AuditIdSchema,
	name: z.string().nullable(),
});
export type AuditLogOrganization = z.output<typeof AuditLogOrganizationSchema>;

// ── Records ─────────────────────────────────────────────────────────────────

/** One record as listed by `GET /admin/audit-logs` — everything except the payloads. */
export const HttpAuditLogSummarySchema = z.object({
	id: z.uuid(),
	correlationId: AuditIdSchema,
	/** Request start (epoch ms). */
	occurredAt: EpochMsSchema,
	/** When the outcome was known (epoch ms). */
	completedAt: EpochMsSchema,
	/** `completedAt - occurredAt`: server time the request took. */
	durationMs: z.number().int().nonnegative(),
	/** As sent (upper-cased): any method a client used, not only the standard ones. */
	method: z.string().min(1).max(AUDIT_METHOD_MAX_LENGTH),
	/** Route template (`/api/v1/geo/cities/:id`). */
	endpoint: z.string().min(1).max(AUDIT_ENDPOINT_MAX_LENGTH),
	/** Concrete URL, sensitive query parameters redacted. */
	path: z.string().min(1).max(AUDIT_URL_MAX_LENGTH),
	outcome: AuditOutcomeSchema,
	responseStatus: z.number().int().min(HTTP_STATUS_MIN).max(HTTP_STATUS_MAX),
	errorCode: z.string().max(AUDIT_ERROR_CODE_MAX_LENGTH).nullable(),
	authMethod: AuditAuthMethodSchema.nullable(),
	actor: AuditLogUserSchema.nullable(),
	/** The real SuperAdmin behind an impersonation session. */
	impersonator: AuditLogUserSchema.nullable(),
	apiKeyId: AuditIdSchema.nullable(),
	terminalId: AuditIdSchema.nullable(),
	organization: AuditLogOrganizationSchema.nullable(),
	storeId: AuditIdSchema.nullable(),
	locationId: AuditIdSchema.nullable(),
	ipAddress: z.string().max(AUDIT_ID_MAX_LENGTH).nullable(),
	userAgent: z.string().max(AUDIT_USER_AGENT_MAX_LENGTH).nullable(),
	/** Parsed from the User-Agent by the API (a description of what the client claimed). */
	browserName: z.string().max(AUDIT_NAME_MAX_LENGTH).nullable(),
	browserVersion: z.string().max(AUDIT_VERSION_MAX_LENGTH).nullable(),
	osName: z.string().max(AUDIT_NAME_MAX_LENGTH).nullable(),
	osVersion: z.string().max(AUDIT_VERSION_MAX_LENGTH).nullable(),
	deviceType: DeviceTypeSchema.nullable(),
	deviceModel: z.string().max(AUDIT_NAME_MAX_LENGTH).nullable(),
	ipVersion: IpVersionSchema.nullable(),
	/** Address class of `ipAddress` (public, private, loopback, …). */
	ipScope: IpAddressScopeSchema.nullable(),
	/** Location from the CDN edge's geo headers — `null` when the API is not behind a geo-locating CDN. */
	geoCountry: z.string().length(COUNTRY_CODE_LENGTH).nullable(),
	geoRegion: z.string().max(AUDIT_NAME_MAX_LENGTH).nullable(),
	geoCity: z.string().max(AUDIT_CITY_MAX_LENGTH).nullable(),
	geoTimeZone: z.string().max(AUDIT_NAME_MAX_LENGTH).nullable(),
	/** The frontend the caller claimed to be (`X-Client-Type`, unverified). */
	clientType: z.string().max(AUDIT_CLIENT_TYPE_MAX_LENGTH).nullable(),
});
export type HttpAuditLogSummary = z.output<typeof HttpAuditLogSummarySchema>;

/** One complete record (`GET /admin/audit-logs/:id`): the summary plus request metadata and the redacted payloads. */
export const HttpAuditLogDetailSchema = HttpAuditLogSummarySchema.extend({
	traceId: AuditIdSchema.nullable(),
	impersonationSessionId: AuditIdSchema.nullable(),
	httpVersion: z.string().max(AUDIT_HTTP_VERSION_MAX_LENGTH).nullable(),
	host: z.string().max(AUDIT_HOST_MAX_LENGTH).nullable(),
	origin: z.string().max(AUDIT_ORIGIN_MAX_LENGTH).nullable(),
	referer: z.string().max(AUDIT_URL_MAX_LENGTH).nullable(),
	acceptLanguage: z.string().max(AUDIT_HEADER_MAX_LENGTH).nullable(),
	requestContentType: z.string().max(AUDIT_HEADER_MAX_LENGTH).nullable(),
	/** Declared request size (`Content-Length`). */
	requestBytes: z.number().int().nonnegative().nullable(),
	idempotencyKey: z.string().max(AUDIT_IDEMPOTENCY_KEY_MAX_LENGTH).nullable(),
	/** Route params + query string (redacted). */
	requestParams: JsonValueSchema.nullable(),
	requestBody: JsonValueSchema.nullable(),
	responseBody: JsonValueSchema.nullable(),
	/** Allowlisted system operations (RLS bypasses) the request ran, in first-use order. */
	systemOperations: z.array(z.string().min(1).max(AUDIT_SYSTEM_OPERATION_MAX_LENGTH)),
	/** When the row was written (epoch ms). */
	createdAt: EpochMsSchema,
});
export type HttpAuditLogDetail = z.output<typeof HttpAuditLogDetailSchema>;

// ── Inputs ──────────────────────────────────────────────────────────────────

/** `GET /admin/audit-logs/:id` path params. */
export const HttpAuditLogIdParamSchema = z.object({ id: z.uuid() }).strict();
export type HttpAuditLogIdParam = z.output<typeof HttpAuditLogIdParamSchema>;

/**
 * `GET /admin/audit-logs` list query (newest first) — see docs/technical/api/list-queries.md.
 * `search` matches the path, route template, correlation id, error code, IP address and User-Agent
 * (trigram-indexed, so a substring search does not scan).
 */
export const httpAuditLogListQuery = defineListQuery({
	sortable: ["occurredAt", "responseStatus", "method", "endpoint"],
	defaultSort: [{ field: "occurredAt", direction: "desc" }],
	filter: {
		outcome: listFilter.enumeration(AuditOutcomeSchema, { eq: true, in: true }),
		method: listFilter.enumeration(AuditHttpMethodSchema, { eq: true, in: true }),
		authMethod: listFilter.enumeration(AuditAuthMethodSchema, { eq: true, in: true, isNull: true }),
		responseStatus: listFilter.number({ eq: true, gte: true, lte: true }),
		endpoint: listFilter.string({ eq: true, contains: true, startsWith: true }),
		errorCode: listFilter.string({ eq: true, in: true }),
		actorUserId: listFilter.uuid({ eq: true, isNull: true }),
		impersonatorUserId: listFilter.uuid({ eq: true, isNull: true }),
		organizationId: listFilter.uuid({ eq: true }),
		apiKeyId: listFilter.uuid({ eq: true }),
		ipAddress: listFilter.string({ eq: true, startsWith: true }),
		ipScope: listFilter.enumeration(IpAddressScopeSchema, { eq: true, in: true }),
		deviceType: listFilter.enumeration(DeviceTypeSchema, { eq: true, in: true, isNull: true }),
		browserName: listFilter.string({ eq: true, in: true }),
		osName: listFilter.string({ eq: true, in: true }),
		geoCountry: listFilter.string({ eq: true, in: true, isNull: true }),
		correlationId: listFilter.string({ eq: true }),
		occurredAt: listFilter.epochMs({ gte: true, lte: true }),
	},
	params: { search: ListSearchSchema },
});
export const HttpAuditLogListQuerySchema = httpAuditLogListQuery.schema;
export type HttpAuditLogListQuery = z.output<typeof HttpAuditLogListQuerySchema>;
export type HttpAuditLogListSortField = (typeof httpAuditLogListQuery.sortable)[number];
