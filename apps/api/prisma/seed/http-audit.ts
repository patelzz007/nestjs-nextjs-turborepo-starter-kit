import type { IdempotencyRecordStatus } from "@prisma/client";
import {
	API_VERSION_PREFIX,
	apiRoutes,
	CLIENT_TYPE_HEADER,
	IDEMPOTENCY_KEY_HEADER,
	LOCATION_ID_HEADER,
	TENANT_ID_HEADER,
	type AuditErrorDetail,
	type AuditRequestHeaders,
} from "@workspace/shared";

import { toAuditLogCreateInput } from "../../src/platform/infrastructure/audit/audit-log.mapper";
import {
	auditDeviceFields,
	auditNetworkFields,
	auditRequestHeaders,
	toAuditPayload,
	UNMATCHED_ENDPOINT,
	type HttpAuditEntry,
} from "../../src/platform/infrastructure/audit/http-audit-entry";
import type { RequestContext } from "../../src/platform/infrastructure/context/request-context";
import { buildIdempotencyScope, hashIdempotentRequest } from "../../src/platform/infrastructure/idempotency/idempotency-request";
import { IDEMPOTENCY_RETENTION_MS } from "../../src/platform/infrastructure/idempotency/idempotency.constants";
import { withSeedAttribution } from "./attributed-session";
import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";
import { SEED_DEVICE_PROFILES } from "./device-sessions";
import { TENANT_SEED_IDS } from "./tenants";

// ---------------------------------------------------------------------------
// Global HTTP audit trail + geo soft delete — demo rows.
//
// Seeds what the API itself writes, through the SAME code paths:
//   - a soft-deleted geo city (is_deleted / deleted_at / deleted_by), exactly
//     as `DELETE /geo/cities/:id` leaves it;
//   - `AuditLog` rows built with the app's payload redaction
//     (`toAuditPayload`: secrets → [REDACTED], personal data masked) and the
//     app's row mapping (`toAuditLogCreateInput`) — one success with the
//     system operations it ran, one failed login, one idempotent create,
//     one session refresh (refresh cookie), one bearer-token validation
//     failure and one audit-viewer sensitive read (GET), so every request
//     metadata column and every auth method has demo data.
// Deterministic ids and timestamps; upserted by id with an empty update, so
// re-seeding never rewrites an audit row (append-only, like the app).
// ---------------------------------------------------------------------------

const HTTP_AUDIT_NAMESPACE = "seed.audit_logs";

/** Fixed demo clock (2026-09-01T09:00:00Z) — keeps every seeded row byte-identical across runs. */
const SEED_AUDIT_BASE_EPOCH_MS = 1_788_253_200_000;
/** Spacing between the demo requests (one minute). */
const SEED_AUDIT_STEP_MS = 60_000;
/** Server time each demo request took. */
const SEED_AUDIT_DURATION_MS = 42;

const SEED_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
/** RFC 5737 documentation address. */
const SEED_CLIENT_IP = "203.0.113.24";
/** The API host the demo requests were addressed to (RFC 2606 reserved domain). */
const SEED_API_HOST = "api.example.com";
/** The admin panel the demo browser requests came from. */
const SEED_ADMIN_ORIGIN = "https://admin.example.com";
const SEED_ACCEPT_LANGUAGE = "en-GB,en;q=0.9";
const SEED_HTTP_VERSION = "1.1";
const SEED_JSON_CONTENT_TYPE = "application/json";
/**
 * Where the CDN edge located the demo admin (browser rows): the seeded deployment
 * sits behind CloudFront, whose viewer headers the API reads from trusted proxies.
 */
const SEED_EDGE_LOCATION = { geoCountry: "MY", geoRegion: "Kuala Lumpur", geoCity: "Kuala Lumpur", geoTimeZone: "Asia/Kuala_Lumpur" };
/** Every geo column NULL — no CDN in front (POS terminals on the merchant LAN, anonymous probes). */
const NO_EDGE_LOCATION = { geoCountry: null, geoRegion: null, geoCity: null, geoTimeZone: null };
const SEED_IPHONE_USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const SEED_CRAWLER_USER_AGENT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
/** An IPv6 documentation address (RFC 3849) for the mobile visit. */
const SEED_MOBILE_CLIENT_IP = "2001:db8::24";

/** Name of the demo city that is seeded already soft-deleted. */
export const SOFT_DELETED_DEMO_CITY_NAME = "Retired Demo City (soft-deleted)";

export interface HttpAuditSeedActors {
	readonly superAdminId: string;
	readonly adminId: string;
	/** The customer the SuperAdmin impersonates in the impersonated-request row. */
	readonly userId: string;
}

/** A paired POS till of the KL merchant, with its store — the machine principal of the POS audit row. */
async function findPairedTill(): Promise<{
	readonly id: string;
	readonly apiKeyId: string;
	readonly terminalId: string;
	readonly locationId: string;
} | null> {
	const till = await prisma.tenantTerminal.findFirst({
		where: { tenantId: TENANT_SEED_IDS.klTenant, isDeleted: false, apiKeyId: { not: null } },
		orderBy: { createdAt: "asc" },
	});
	if (till?.apiKeyId === undefined || till.apiKeyId === null) {
		return null;
	}
	return { id: till.id, apiKeyId: till.apiKeyId, terminalId: till.terminalId, locationId: till.locationId };
}

export interface HttpAuditSeedSummary {
	readonly auditRows: number;
	readonly softDeletedCities: number;
	readonly idempotencyRecords: number;
}

/** The demo product create the idempotent audit row describes. */
const SEED_IDEMPOTENT_PRODUCT_BODY = { name: "Seed Demo Mug", sku: "SEED-MUG-001", price: 12 };
const SEED_IDEMPOTENCY_KEY = "seed-demo-product-create-0001";

/** Demo request numbers of the auth-method / sensitive-read rows (each number is used once across the seed modules). */
const SESSION_REFRESH_REQUEST = 20;
const BEARER_VALIDATION_FAILURE_REQUEST = 21;
const AUDIT_VIEWER_READ_REQUEST = 22;
const PAGE_READ_REQUEST = 23;
const MOBILE_PROFILE_READ_REQUEST = 24;
const CRAWLER_UNKNOWN_ROUTE_REQUEST = 25;
const MOBILE_SESSION_REFRESH_REQUEST = 26;
/** Placeholder tokens of the seeded mobile refresh — never valid, and redacted before storage like real ones. */
const SEED_BODY_REFRESH_TOKEN = "seed-mobile-refresh-token";
const SEED_BODY_ACCESS_TOKEN = "seed-mobile-access-token";

/**
 * The completed `Idempotency-Key` record of the demo product create, built
 * with the app's own scope + fingerprint functions (so a replay of exactly
 * this request would match it). Upserted on its unique (scope, key).
 */
async function ensureIdempotencyRecord(adminId: string, row: HttpAuditEntry, responseBody: { success: true; data: object }): Promise<void> {
	const context: RequestContext = {
		correlationId: row.correlationId,
		traceId: row.correlationId,
		ip: undefined,
		userAgent: undefined,
		edgeLocation: undefined,
		principal: {
			userId: adminId,
			impersonatorId: undefined,
			impersonationSessionId: undefined,
			authMethod: "SESSION_COOKIE",
			sessionId: seedSessionId(adminId),
			identity: { email: "admin@example.com", fullName: undefined },
		},
		apiKey: undefined,
		tenant: { tenantId: undefined, locationId: undefined },
		systemOperations: [],
		receivedAtEpochMs: row.occurredAt,
		supportAccessGrantId: undefined,
		isAuditRecorded: false,
		actor: undefined,
	};
	const scope: string = buildIdempotencyScope(context, row.method, row.endpoint);
	const requestHash: string = hashIdempotentRequest({ method: row.method, url: row.path, body: { kind: "json", value: SEED_IDEMPOTENT_PRODUCT_BODY } });
	const status: IdempotencyRecordStatus = "COMPLETED";
	const data = {
		requestHash,
		leaseToken: deterministicUuid(`${HTTP_AUDIT_NAMESPACE}.lease`, SEED_IDEMPOTENCY_KEY),
		status,
		responseBody: { body: responseBody },
		expiresAt: BigInt(row.completedAt + IDEMPOTENCY_RETENTION_MS),
		createdAt: BigInt(row.occurredAt),
		updatedAt: BigInt(row.completedAt),
	};
	await prisma.platformResourceIdempotencyRecord.upsert({
		where: { scope_idempotencyKey: { scope, idempotencyKey: SEED_IDEMPOTENCY_KEY } },
		create: { scope, idempotencyKey: SEED_IDEMPOTENCY_KEY, ...data },
		update: {},
	});
}

/** A soft-deleted city under the first live state — what a SuperAdmin delete leaves behind. Returns its id. */
async function ensureSoftDeletedDemoCity(superAdminId: string, deletedAt: number): Promise<number | null> {
	const state = await prisma.state.findFirst({ where: { isDeleted: false }, orderBy: { id: "asc" } });
	if (state === null) {
		return null;
	}
	const existing = await prisma.city.findFirst({ where: { name: SOFT_DELETED_DEMO_CITY_NAME, stateId: state.id } });
	if (existing !== null) {
		return existing.id;
	}
	const city = await prisma.city.create({
		data: {
			name: SOFT_DELETED_DEMO_CITY_NAME,
			stateId: state.id,
			countryId: state.countryId,
			stateCode: state.iso2 ?? "",
			countryCode: state.countryCode,
			latitude: 0,
			longitude: 0,
			isDeleted: true,
			deletedAt: BigInt(deletedAt),
			deletedBy: superAdminId,
		},
	});
	return city.id;
}

/** Request-metadata columns `entry()` fills with a browser-session default; a row overrides what differs. */
type SeedRequestMetadata = Pick<
	HttpAuditEntry,
	| "ipAddress"
	| "userAgent"
	| "geoCountry"
	| "geoRegion"
	| "geoCity"
	| "geoTimeZone"
	| "impersonationSessionId"
	| "supportAccessGrantId"
	| "sessionId"
	| "claimedTenantId"
	| "claimedLocationId"
	| "authMethod"
	| "clientType"
	| "httpVersion"
	| "host"
	| "origin"
	| "referer"
	| "acceptLanguage"
	| "requestContentType"
	| "requestBytes"
	| "idempotencyKey"
	| "errorDetail"
>;

/** Columns the API derives from the User-Agent and the address — the seed derives them the same way. */
type DerivedClientFields = "browserName" | "browserVersion" | "osName" | "osVersion" | "deviceType" | "deviceModel" | "ipVersion" | "ipScope";

/** The fields each seeded row states itself (the rest come from the demo clock and client). */
export type SeedAuditFields = Omit<
	HttpAuditEntry,
	"correlationId" | "traceId" | "occurredAt" | "completedAt" | "requestHeaders" | "actorIdentity" | DerivedClientFields | keyof SeedRequestMetadata
> &
	Partial<SeedRequestMetadata>;

/** The device session a demo actor's browser requests ran under (an id, like the API records: no foreign key). */
function seedSessionId(actorUserId: string): string {
	return deterministicUuid(`${HTTP_AUDIT_NAMESPACE}.session`, actorUserId);
}

/** The access-token cookie name the seeded browser sends (the value is never recorded). */
const SEED_SESSION_COOKIE = "admin_access_token";

/**
 * The cause the API would have recorded for a demo failure: what was thrown
 * (an `AppError` named by its code), without a stack — a 4xx is the caller's
 * mistake, not a code path.
 */
function seedErrorDetail(fields: SeedAuditFields): AuditErrorDetail | null {
	if (fields.outcome === "SUCCEEDED" || fields.errorCode === null) {
		return null;
	}
	return { type: "AppError", message: `Request refused: ${fields.errorCode}`, code: fields.errorCode, causes: [], stack: [] };
}

/**
 * The headers a demo request carried, built from its stated metadata and
 * stored through the API's own redaction (`auditRequestHeaders`): the session
 * cookie keeps its name only, an API key is `[REDACTED]`.
 */
function seedRequestHeaders(stated: SeedAuditFields & SeedRequestMetadata): AuditRequestHeaders {
	const optional = (name: string, value: string | number | null): Record<string, string> => (value === null ? {} : { [name.toLowerCase()]: String(value) });
	return auditRequestHeaders({
		accept: "application/json",
		...optional("host", stated.host),
		...optional("user-agent", stated.userAgent),
		...optional("accept-language", stated.acceptLanguage),
		...optional("origin", stated.origin),
		...optional("referer", stated.referer),
		...optional("content-type", stated.requestContentType),
		...optional("content-length", stated.requestBytes),
		...optional(CLIENT_TYPE_HEADER, stated.clientType),
		...optional(IDEMPOTENCY_KEY_HEADER, stated.idempotencyKey),
		...optional(TENANT_ID_HEADER, stated.claimedTenantId),
		...optional(LOCATION_ID_HEADER, stated.claimedLocationId),
		...(stated.authMethod === "SESSION_COOKIE" ? { cookie: `${SEED_SESSION_COOKIE}=seed; theme=light` } : {}),
		...(stated.apiKeyId === null ? {} : { "x-api-key": "seed-api-key" }),
	});
}

/**
 * Defaults for the request-metadata columns: a user request is an admin-panel
 * browser session (cookie auth, Origin / Referer of the panel); an API-key
 * request is a POS terminal (no browser headers); anything else is anonymous.
 */
function defaultRequestMetadata(fields: SeedAuditFields): SeedRequestMetadata {
	const isBrowser: boolean = fields.actorUserId !== null;
	const body: string | null = fields.requestBody === null ? null : JSON.stringify(fields.requestBody);
	return {
		ipAddress: SEED_CLIENT_IP,
		userAgent: SEED_USER_AGENT,
		...(isBrowser ? SEED_EDGE_LOCATION : NO_EDGE_LOCATION),
		impersonationSessionId: null,
		supportAccessGrantId: null,
		sessionId: fields.actorUserId === null ? null : seedSessionId(fields.actorUserId),
		// The merchant console and the POS till name their tenant and store on every call.
		claimedTenantId: fields.tenantId,
		claimedLocationId: fields.locationId,
		authMethod: isBrowser ? "SESSION_COOKIE" : fields.apiKeyId === null ? null : "API_KEY",
		clientType: isBrowser ? "admin" : null,
		httpVersion: SEED_HTTP_VERSION,
		host: SEED_API_HOST,
		origin: isBrowser ? SEED_ADMIN_ORIGIN : null,
		referer: isBrowser ? `${SEED_ADMIN_ORIGIN}/` : null,
		acceptLanguage: isBrowser ? SEED_ACCEPT_LANGUAGE : null,
		requestContentType: body === null ? null : SEED_JSON_CONTENT_TYPE,
		requestBytes: body === null ? null : Buffer.byteLength(body, "utf8"),
		idempotencyKey: null,
		errorDetail: seedErrorDetail(fields),
	};
}

/** The correlation id of demo request #`index` — what its seeded row changes join it by (attributed-session.ts). */
export function seedAuditCorrelationId(index: number): string {
	return `seed-${deterministicUuid(`${HTTP_AUDIT_NAMESPACE}.correlation`, String(index))}`;
}

/**
 * One demo request's audit row: the deterministic id, correlation id, clock and
 * client of request #`index` (each number is used once across the seed modules).
 */
export function entry(index: number, fields: SeedAuditFields): { readonly id: string; readonly row: HttpAuditEntry } {
	const occurredAt: number = SEED_AUDIT_BASE_EPOCH_MS + index * SEED_AUDIT_STEP_MS;
	const correlationId: string = seedAuditCorrelationId(index);
	const stated = { ...defaultRequestMetadata(fields), ...fields };
	return {
		id: deterministicUuid(HTTP_AUDIT_NAMESPACE, String(index)),
		row: {
			...stated,
			requestHeaders: seedRequestHeaders(stated),
			actorIdentity: null,
			...auditDeviceFields(stated.userAgent),
			...auditNetworkFields(stated.ipAddress),
			correlationId,
			traceId: correlationId,
			occurredAt,
			completedAt: occurredAt + SEED_AUDIT_DURATION_MS,
		},
	};
}

/** The POS till's checkout request on the shared seeded audit clock. */
const POS_CHECKOUT_REQUEST = 3;

/**
 * What the API-key guard writes on every call from a registered till
 * (`MerchantTerminalRepository.touchLastSeen`): `lastSeenAt` = the request
 * time — run under the till's API-key session, so its change record joins the
 * seeded checkout request. Skipped once the till already shows that call, so
 * re-seeding writes (and records) nothing new.
 */
async function recordPosTerminalCall(till: { readonly id: string; readonly apiKeyId: string }, requestIndex: number): Promise<void> {
	const lastSeenAt: number = SEED_AUDIT_BASE_EPOCH_MS + requestIndex * SEED_AUDIT_STEP_MS;
	await withSeedAttribution(
		{
			correlationId: seedAuditCorrelationId(requestIndex),
			actorUserId: null,
			tenantId: TENANT_SEED_IDS.klTenant,
			apiKeyId: till.apiKeyId,
			systemOperation: null,
			actorPurpose: null,
		},
		async (tx) =>
			tx.tenantTerminal.updateMany({
				where: { id: till.id, OR: [{ lastSeenAt: null }, { lastSeenAt: { not: BigInt(lastSeenAt) } }] },
				data: { lastSeenAt: BigInt(lastSeenAt) },
			}),
	);
}

/** Audit columns of a request with no tenant scope. */
export const NO_TENANT = { tenantId: null, locationId: null };
/** Audit columns of a request made by a user (no API key / POS terminal). */
export const NO_MACHINE_PRINCIPAL = { apiKeyId: null, terminalId: null };

export async function seedHttpAuditTrail(actors: HttpAuditSeedActors): Promise<HttpAuditSeedSummary> {
	const deletedAt: number = SEED_AUDIT_BASE_EPOCH_MS;
	const cityId: number | null = await ensureSoftDeletedDemoCity(actors.superAdminId, deletedAt);
	const cityPath = `${API_VERSION_PREFIX}/geo/cities/${String(cityId ?? 0)}`;

	const rows = [
		entry(0, {
			method: "DELETE",
			endpoint: `${API_VERSION_PREFIX}/geo/cities/:id`,
			path: cityPath,
			outcome: "SUCCEEDED",
			responseStatus: 200,
			errorCode: null,
			actorUserId: actors.superAdminId,
			impersonatorUserId: null,
			...NO_MACHINE_PRINCIPAL,
			...NO_TENANT,
			requestParams: toAuditPayload({ params: { id: String(cityId ?? 0) }, query: {} }),
			requestBody: null,
			responseBody: toAuditPayload({ message: `City #${String(cityId ?? 0)} deleted` }),
			systemOperations: ["geo.reference_data.write"],
		}),
		entry(1, {
			method: "POST",
			endpoint: `${API_VERSION_PREFIX}/auth/login`,
			path: `${API_VERSION_PREFIX}/auth/login`,
			outcome: "FAILED",
			responseStatus: 401,
			errorCode: "INVALID_CREDENTIALS",
			actorUserId: null,
			impersonatorUserId: null,
			...NO_MACHINE_PRINCIPAL,
			...NO_TENANT,
			requestParams: toAuditPayload({ params: {}, query: {} }),
			requestBody: toAuditPayload({ email: "admin@example.com", password: "wrong-password" }),
			responseBody: toAuditPayload({ success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } }),
			systemOperations: [],
			// Anonymous (no credential yet), but sent by the admin panel's login form.
			clientType: "admin",
			origin: SEED_ADMIN_ORIGIN,
			referer: `${SEED_ADMIN_ORIGIN}/auth/login`,
			acceptLanguage: SEED_ACCEPT_LANGUAGE,
		}),
		entry(SESSION_REFRESH_REQUEST, {
			method: "POST",
			endpoint: `${API_VERSION_PREFIX}${apiRoutes.auth.refresh}`,
			path: `${API_VERSION_PREFIX}${apiRoutes.auth.refresh}`,
			outcome: "SUCCEEDED",
			responseStatus: 200,
			errorCode: null,
			actorUserId: actors.adminId,
			impersonatorUserId: null,
			...NO_MACHINE_PRINCIPAL,
			...NO_TENANT,
			requestParams: toAuditPayload({ params: {}, query: {} }),
			requestBody: null,
			responseBody: toAuditPayload({ success: true, data: { message: "Tokens refreshed" } }),
			systemOperations: [],
			authMethod: "REFRESH_COOKIE",
		}),
		// The mobile app rotating its tokens: the refresh token travels in the body (redacted), the rotated pair in the response (redacted).
		entry(MOBILE_SESSION_REFRESH_REQUEST, {
			method: "POST",
			endpoint: `${API_VERSION_PREFIX}${apiRoutes.auth.refresh}`,
			path: `${API_VERSION_PREFIX}${apiRoutes.auth.refresh}`,
			outcome: "SUCCEEDED",
			responseStatus: 200,
			errorCode: null,
			actorUserId: actors.userId,
			impersonatorUserId: null,
			...NO_MACHINE_PRINCIPAL,
			...NO_TENANT,
			requestParams: toAuditPayload({ params: {}, query: {} }),
			// The app's own redaction replaces both tokens with [REDACTED], exactly as for a live request.
			requestBody: toAuditPayload({ refreshToken: SEED_BODY_REFRESH_TOKEN }),
			responseBody: toAuditPayload({
				success: true,
				data: { message: "Tokens refreshed successfully", tokenTransport: "body", accessToken: SEED_BODY_ACCESS_TOKEN, refreshToken: SEED_BODY_REFRESH_TOKEN },
			}),
			systemOperations: [],
			authMethod: "REFRESH_BODY",
			clientType: "mobile",
			userAgent: SEED_DEVICE_PROFILES.mobileIphone.userAgent,
			ipAddress: SEED_MOBILE_CLIENT_IP,
			origin: null,
			referer: null,
			acceptLanguage: null,
		}),
		entry(BEARER_VALIDATION_FAILURE_REQUEST, {
			method: "POST",
			endpoint: `${API_VERSION_PREFIX}/product`,
			path: `${API_VERSION_PREFIX}/product`,
			outcome: "FAILED",
			responseStatus: 400,
			errorCode: "VALIDATION_ERROR",
			actorUserId: actors.adminId,
			impersonatorUserId: null,
			...NO_MACHINE_PRINCIPAL,
			...NO_TENANT,
			requestParams: toAuditPayload({ params: {}, query: {} }),
			requestBody: toAuditPayload({ name: "", sku: "SEED-MUG-002", price: -1 }),
			responseBody: toAuditPayload({ success: false, error: { code: "VALIDATION_ERROR", message: "Request validation failed" } }),
			systemOperations: [],
			// A script calling the API with a bearer token: no browser headers.
			authMethod: "BEARER_TOKEN",
			clientType: null,
			origin: null,
			referer: null,
			acceptLanguage: null,
		}),
		entry(AUDIT_VIEWER_READ_REQUEST, {
			method: "GET",
			endpoint: `${API_VERSION_PREFIX}${apiRoutes.auditLogs.list}`,
			path: `${API_VERSION_PREFIX}${apiRoutes.auditLogs.list}?filter%5Boutcome%5D%5Beq%5D=FAILED`,
			outcome: "SUCCEEDED",
			responseStatus: 200,
			errorCode: null,
			actorUserId: actors.adminId,
			impersonatorUserId: null,
			...NO_MACHINE_PRINCIPAL,
			...NO_TENANT,
			requestParams: toAuditPayload({ params: {}, query: { "filter[outcome][eq]": "FAILED" } }),
			requestBody: null,
			// A sensitive read stores what was released, never the data itself.
			responseBody: toAuditPayload({ auditLogView: { view: "list", returned: 2, total: 2, page: 1 } }),
			systemOperations: ["audit.http_request.read", "audit.http_request.record"],
			referer: `${SEED_ADMIN_ORIGIN}/audit-logs`,
		}),
		// Every read is audited, not only sensitive ones: an ordinary admin page load…
		entry(PAGE_READ_REQUEST, {
			method: "GET",
			endpoint: `${API_VERSION_PREFIX}${apiRoutes.geo.stats}`,
			path: `${API_VERSION_PREFIX}${apiRoutes.geo.stats}`,
			outcome: "SUCCEEDED",
			responseStatus: 200,
			errorCode: null,
			actorUserId: actors.adminId,
			impersonatorUserId: null,
			...NO_MACHINE_PRINCIPAL,
			...NO_TENANT,
			requestParams: toAuditPayload({ params: {}, query: {} }),
			requestBody: null,
			responseBody: toAuditPayload({ success: true, data: { regions: 6, subregions: 22, countries: 250, states: 5_000, cities: 150_000 } }),
			systemOperations: ["audit.http_request.record"],
			referer: `${SEED_ADMIN_ORIGIN}/geography`,
		}),
		// …a customer reading their profile on an iPhone (IPv6)…
		entry(MOBILE_PROFILE_READ_REQUEST, {
			method: "GET",
			endpoint: `${API_VERSION_PREFIX}${apiRoutes.auth.profile}`,
			path: `${API_VERSION_PREFIX}${apiRoutes.auth.profile}`,
			outcome: "SUCCEEDED",
			responseStatus: 200,
			errorCode: null,
			actorUserId: actors.userId,
			impersonatorUserId: null,
			...NO_MACHINE_PRINCIPAL,
			...NO_TENANT,
			requestParams: toAuditPayload({ params: {}, query: {} }),
			requestBody: null,
			responseBody: toAuditPayload({ success: true, data: { email: "user@example.com", fullName: "Demo Customer", version: 1 } }),
			systemOperations: ["audit.http_request.record"],
			userAgent: SEED_IPHONE_USER_AGENT,
			ipAddress: SEED_MOBILE_CLIENT_IP,
			clientType: "web",
			origin: "https://app.example.com",
			referer: "https://app.example.com/account",
		}),
		// …and a crawler probing a route that does not exist (anonymous, unmatched → 404).
		entry(CRAWLER_UNKNOWN_ROUTE_REQUEST, {
			method: "GET",
			endpoint: UNMATCHED_ENDPOINT,
			path: "/wp-login.php",
			outcome: "FAILED",
			responseStatus: 404,
			errorCode: "NOT_FOUND",
			actorUserId: null,
			impersonatorUserId: null,
			...NO_MACHINE_PRINCIPAL,
			...NO_TENANT,
			requestParams: toAuditPayload({ params: {}, query: {} }),
			requestBody: null,
			responseBody: toAuditPayload({ success: false, error: { code: "NOT_FOUND", message: "Route not found" } }),
			systemOperations: [],
			userAgent: SEED_CRAWLER_USER_AGENT,
		}),
		entry(2, {
			method: "POST",
			endpoint: `${API_VERSION_PREFIX}/product`,
			path: `${API_VERSION_PREFIX}/product`,
			outcome: "SUCCEEDED",
			responseStatus: 201,
			errorCode: null,
			actorUserId: actors.adminId,
			impersonatorUserId: null,
			...NO_MACHINE_PRINCIPAL,
			...NO_TENANT,
			requestParams: toAuditPayload({ params: {}, query: {} }),
			requestBody: toAuditPayload(SEED_IDEMPOTENT_PRODUCT_BODY),
			responseBody: toAuditPayload({ success: true, data: { name: "Seed Demo Mug", sku: "SEED-MUG-001" } }),
			systemOperations: ["http.idempotency", "audit.http_request.record"],
			idempotencyKey: SEED_IDEMPOTENCY_KEY,
		}),
	];

	const till = await findPairedTill();
	if (till !== null) {
		rows.push(
			entry(POS_CHECKOUT_REQUEST, {
				method: "POST",
				endpoint: `${API_VERSION_PREFIX}/integration/redemptions/checkout`,
				path: `${API_VERSION_PREFIX}/integration/redemptions/checkout`,
				outcome: "SUCCEEDED",
				responseStatus: 201,
				errorCode: null,
				actorUserId: null,
				impersonatorUserId: null,
				apiKeyId: till.apiKeyId,
				terminalId: till.terminalId,
				tenantId: TENANT_SEED_IDS.klTenant,
				locationId: till.locationId,
				requestParams: toAuditPayload({ params: {}, query: {} }),
				requestBody: toAuditPayload({ idempotencyKey: "seed-pos-checkout-0001", billTotalMinor: 4590, codes: ["QR-SEED-0001"] }),
				responseBody: toAuditPayload({ success: true, data: { saleId: "seed-sale", redeemed: 1 } }),
				systemOperations: [],
			}),
		);
		await recordPosTerminalCall(till, POS_CHECKOUT_REQUEST);
	}
	// The impersonated request (a refused profile edit) is seeded with the rest
	// of the self-service profile history by `seedOwnProfileHistory` (own-profile.ts).

	for (const { id, row } of rows) {
		await prisma.auditLog.upsert({ where: { id }, create: { id, ...toAuditLogCreateInput(row) }, update: {} });
	}
	const idempotentCreate = rows.find(({ row }) => row.idempotencyKey === SEED_IDEMPOTENCY_KEY);
	if (idempotentCreate !== undefined) {
		await ensureIdempotencyRecord(actors.adminId, idempotentCreate.row, {
			success: true,
			data: { name: SEED_IDEMPOTENT_PRODUCT_BODY.name, sku: SEED_IDEMPOTENT_PRODUCT_BODY.sku },
		});
	}
	return { auditRows: rows.length, softDeletedCities: cityId === null ? 0 : 1, idempotencyRecords: idempotentCreate === undefined ? 0 : 1 };
}
