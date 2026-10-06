import type { IdempotencyRecordStatus } from "@prisma/client";
import { API_VERSION_PREFIX, apiRoutes } from "@workspace/shared";

import { toAuditLogCreateInput } from "../../src/common/audit/audit-log.mapper";
import { auditDeviceFields, auditNetworkFields, toAuditPayload, UNMATCHED_ENDPOINT, type HttpAuditEntry } from "../../src/common/audit/http-audit-entry";
import type { RequestContext } from "../../src/common/context/request-context";
import { buildIdempotencyScope, hashIdempotentRequest } from "../../src/platform/idempotency/idempotency-request";
import { IDEMPOTENCY_RETENTION_MS } from "../../src/platform/idempotency/idempotency.constants";
import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";
import { ORGANIZATION_SEED_IDS } from "./organizations";

// ---------------------------------------------------------------------------
// Global HTTP audit trail + geo soft delete — demo rows.
//
// Seeds what the API itself writes, through the SAME code paths:
//   - a soft-deleted geo city (is_deleted / deleted_at / deleted_by), exactly
//     as `DELETE /geo/cities/:id` leaves it;
//   - `audit_logs` rows built with the app's payload redaction
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
async function findPairedTill(): Promise<{ readonly apiKeyId: string; readonly terminalId: string; readonly locationId: string; readonly storeId: string | null } | null> {
	const till = await prisma.organizationTerminal.findFirst({
		where: { organizationId: ORGANIZATION_SEED_IDS.klOrganization, isDeleted: false, apiKeyId: { not: null } },
		orderBy: { createdAt: "asc" },
	});
	if (till?.apiKeyId === undefined || till.apiKeyId === null) {
		return null;
	}
	const store = await prisma.store.findFirst({ where: { locationId: till.locationId, isDeleted: false } });
	return { apiKeyId: till.apiKeyId, terminalId: till.terminalId, locationId: till.locationId, storeId: store?.id ?? null };
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
		principal: { userId: adminId, impersonatorId: undefined, impersonationSessionId: undefined, authMethod: "SESSION_COOKIE" },
		apiKey: undefined,
		tenant: { organizationId: undefined, storeId: undefined, locationId: undefined },
		systemOperations: [],
		receivedAtEpochMs: row.occurredAt,
		isAuditRecorded: false,
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
>;

/** Columns the API derives from the User-Agent and the address — the seed derives them the same way. */
type DerivedClientFields = "browserName" | "browserVersion" | "osName" | "osVersion" | "deviceType" | "deviceModel" | "ipVersion" | "ipScope";

/** The fields each seeded row states itself (the rest come from the demo clock and client). */
export type SeedAuditFields = Omit<HttpAuditEntry, "correlationId" | "traceId" | "occurredAt" | "completedAt" | DerivedClientFields | keyof SeedRequestMetadata> &
	Partial<SeedRequestMetadata>;

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
	};
}

/**
 * One demo request's audit row: the deterministic id, correlation id, clock and
 * client of request #`index` (each number is used once across the seed modules).
 */
export function entry(index: number, fields: SeedAuditFields): { readonly id: string; readonly row: HttpAuditEntry } {
	const occurredAt: number = SEED_AUDIT_BASE_EPOCH_MS + index * SEED_AUDIT_STEP_MS;
	const correlationId = `seed-${deterministicUuid(`${HTTP_AUDIT_NAMESPACE}.correlation`, String(index))}`;
	const stated = { ...defaultRequestMetadata(fields), ...fields };
	return {
		id: deterministicUuid(HTTP_AUDIT_NAMESPACE, String(index)),
		row: {
			...stated,
			...auditDeviceFields(stated.userAgent),
			...auditNetworkFields(stated.ipAddress),
			correlationId,
			traceId: correlationId,
			occurredAt,
			completedAt: occurredAt + SEED_AUDIT_DURATION_MS,
		},
	};
}

/** Audit columns of a request with no tenant scope. */
export const NO_TENANT = { organizationId: null, storeId: null, locationId: null };
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
			systemOperations: ["platform.superadmin", "geo.reference_data.write"],
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
			entry(3, {
				method: "POST",
				endpoint: `${API_VERSION_PREFIX}/redemptions/checkout`,
				path: `${API_VERSION_PREFIX}/redemptions/checkout`,
				outcome: "SUCCEEDED",
				responseStatus: 201,
				errorCode: null,
				actorUserId: null,
				impersonatorUserId: null,
				apiKeyId: till.apiKeyId,
				terminalId: till.terminalId,
				organizationId: ORGANIZATION_SEED_IDS.klOrganization,
				storeId: till.storeId,
				locationId: till.locationId,
				requestParams: toAuditPayload({ params: {}, query: {} }),
				requestBody: toAuditPayload({ idempotencyKey: "seed-pos-checkout-0001", billTotalMinor: 4590, codes: ["QR-SEED-0001"] }),
				responseBody: toAuditPayload({ success: true, data: { saleId: "seed-sale", redeemed: 1 } }),
				systemOperations: ["route.rls_bypass"],
			}),
		);
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
