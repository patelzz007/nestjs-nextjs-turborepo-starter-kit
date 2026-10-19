import {
	AuditTrailEntrySchema,
	DataChangeLogDetailSchema,
	DataChangeLogSummarySchema,
	HttpAuditLogDetailSchema,
	HttpAuditLogSummarySchema,
	type AuditTrailEntry,
	type DataChangeLogDetail,
	type DataChangeLogSummary,
	type HttpAuditLogDetail,
	type HttpAuditLogSummary,
} from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

export const VIEWER_ID = "99999999-9999-4999-8999-999999999999";
export const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
export const ORGANIZATION_ID = "33333333-3333-4333-8333-333333333333";
export const OCCURRED_AT = 1_790_812_800_000;
/** How long the fixture request took, in ms. */
const REQUEST_DURATION_MS = 10;

/** The admin opening the audit log. */
export const VIEWER: ActorContext = {
	kind: "user",
	userId: VIEWER_ID,
	sessionId: "session-1",
	organizationId: null,
	isSuperAdmin: false,
	accessScope: "staff_single_tenant",
	impersonatorUserId: null,
	request: { requestId: "corr-view", ip: "203.0.113.24", userAgent: "vitest-agent", deviceLabel: null, endpoint: "/api/v1/admin/audit-logs" },
	routeRlsBypass: false,
};

/** Hex digits in a uuid's last group. */
const UUID_NODE_DIGITS = 12;
/** First transaction id of the fixture changes (any positive id; each change gets its own). */
const FIRST_TRANSACTION_ID = 500;

/** The `n`-th (1-based) record id of a fixture list: a valid, distinct v4 uuid. */
export function recordId(n: number): string {
	return `55555555-5555-4555-8555-${String(n).padStart(UUID_NODE_DIGITS, "0")}`;
}

export function httpAuditLogSummary(n: number): HttpAuditLogSummary {
	return HttpAuditLogSummarySchema.parse({
		id: recordId(n),
		correlationId: `corr-${String(n)}`,
		occurredAt: OCCURRED_AT - n,
		completedAt: OCCURRED_AT - n + REQUEST_DURATION_MS,
		durationMs: REQUEST_DURATION_MS,
		method: "POST",
		endpoint: "/api/v1/product",
		path: "/api/v1/product",
		outcome: "SUCCEEDED",
		responseStatus: 201,
		errorCode: null,
		authMethod: "SESSION_COOKIE",
		actor: { id: ACTOR_ID, email: "admin@example.com", fullName: "Admin" },
		impersonator: null,
		apiKeyId: null,
		terminalId: null,
		organization: { id: ORGANIZATION_ID, name: "Kopi Corner" },
		storeId: null,
		locationId: null,
		ipAddress: "203.0.113.24",
		userAgent: "vitest-agent",
		browserName: null,
		browserVersion: null,
		osName: null,
		osVersion: null,
		deviceType: "UNKNOWN",
		deviceModel: null,
		ipVersion: 4,
		ipScope: "DOCUMENTATION",
		geoCountry: null,
		geoRegion: null,
		geoCity: null,
		geoTimeZone: null,
		clientType: "admin",
	});
}

export function httpAuditLogDetail(n: number): HttpAuditLogDetail {
	return HttpAuditLogDetailSchema.parse({
		...httpAuditLogSummary(n),
		traceId: `corr-${String(n)}`,
		impersonationSessionId: null,
		httpVersion: "1.1",
		host: "api.example.com",
		origin: null,
		referer: null,
		acceptLanguage: null,
		requestContentType: "application/json",
		requestBytes: 12,
		idempotencyKey: null,
		requestParams: null,
		requestBody: { name: "Mug" },
		responseBody: { success: true },
		systemOperations: [],
		createdAt: OCCURRED_AT - n + REQUEST_DURATION_MS,
	});
}

export function dataChangeLogSummary(n: number): DataChangeLogSummary {
	return DataChangeLogSummarySchema.parse({
		id: recordId(n),
		changeSequence: n,
		occurredAt: OCCURRED_AT - n,
		transactionId: FIRST_TRANSACTION_ID + n,
		tableName: "Reward",
		operation: "UPDATE",
		rowId: "66666666-6666-4666-8666-666666666666",
		changedColumns: ["status"],
		actorKind: "USER",
		actor: { id: ACTOR_ID, email: "admin@example.com", fullName: "Admin" },
		organization: { id: ORGANIZATION_ID, name: "Kopi Corner" },
		apiKeyId: null,
		systemOperation: null,
		correlationId: `corr-${String(n)}`,
		databaseRole: "app_runtime",
	});
}

export function dataChangeLogDetail(n: number): DataChangeLogDetail {
	return DataChangeLogDetailSchema.parse({
		...dataChangeLogSummary(n),
		oldData: { status: "DRAFT" },
		newData: { status: "PUBLISHED" },
		actorPurpose: null,
		loginRole: "api",
		applicationName: null,
		clientAddress: "10.0.0.12",
		createdAt: OCCURRED_AT - n + 1,
	});
}

/** A background entry of the timeline (a job's writes). */
export function backgroundEntry(n: number): AuditTrailEntry {
	const change = dataChangeLogSummary(n);
	return AuditTrailEntrySchema.parse({
		kind: "BACKGROUND",
		id: change.id,
		occurredAt: change.occurredAt,
		actorKind: change.actorKind,
		actor: change.actor,
		organization: change.organization,
		apiKeyId: change.apiKeyId,
		systemOperation: change.systemOperation,
		correlationId: change.correlationId,
		databaseRole: change.databaseRole,
		operation: change.operation,
		rowId: change.rowId,
		changeCount: 1,
		changedTables: [change.tableName],
	});
}

/** A request entry of the timeline. */
export function requestEntry(n: number): AuditTrailEntry {
	return AuditTrailEntrySchema.parse({ ...httpAuditLogSummary(n), kind: "REQUEST", changeCount: 0, changedTables: [] });
}

/** `count` records built by `build`, numbered from 1. */
export function many<TRecord>(count: number, build: (n: number) => TRecord): TRecord[] {
	return Array.from({ length: count }, (_unused, index): TRecord => build(index + 1));
}
