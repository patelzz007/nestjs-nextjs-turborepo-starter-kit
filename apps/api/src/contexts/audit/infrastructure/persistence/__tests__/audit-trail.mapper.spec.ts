import { describe, expect, it } from "vitest";

import { toAuditLogReferences } from "../audit-references";
import { auditTrailChangeGroups, auditTrailReferenceIds, toAuditTrailEntry, type AuditTrailPageRows } from "../audit-trail.mapper";
import type { DataChangeLogSummaryRow } from "../prisma-data-change-log.read-repository";
import type { AuditLogSummaryRow } from "../prisma-http-audit-log.read-repository";

const OCCURRED_AT = 1_790_812_800_000;
const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_ID = "33333333-3333-4333-8333-333333333333";
const REQUEST_ID = "55555555-5555-4555-8555-555555555555";
const CHANGE_ID = "66666666-6666-4666-8666-666666666666";

const REQUEST: AuditLogSummaryRow = {
	id: REQUEST_ID,
	correlationId: "corr-request",
	occurredAt: BigInt(OCCURRED_AT),
	completedAt: BigInt(OCCURRED_AT + 5),
	method: "PATCH",
	endpoint: "/api/v1/auth/profile",
	path: "/api/v1/auth/profile",
	outcome: "SUCCEEDED",
	responseStatus: 200,
	errorCode: null,
	authMethod: "SESSION_COOKIE",
	actorUserId: ACTOR_ID,
	impersonatorUserId: null,
	apiKeyId: null,
	terminalId: null,
	tenantId: TENANT_ID,
	locationId: null,
	ipAddress: "203.0.113.24",
	userAgent: null,
	browserName: null,
	browserVersion: null,
	osName: null,
	osVersion: null,
	deviceType: null,
	deviceModel: null,
	ipVersion: 4,
	ipScope: "DOCUMENTATION",
	geoCountry: null,
	geoRegion: null,
	geoCity: null,
	geoTimeZone: null,
	clientType: null,
};

function change(overrides: Partial<DataChangeLogSummaryRow> = {}): DataChangeLogSummaryRow {
	return {
		id: CHANGE_ID,
		changeSequence: BigInt(1),
		occurredAt: BigInt(OCCURRED_AT + 60_000),
		transactionId: BigInt(77),
		tableName: "outbox_targets",
		operation: "UPDATE",
		rowId: "row-1",
		changedColumns: ["status"],
		actorKind: "SYSTEM",
		actorUserId: null,
		tenantId: null,
		apiKeyId: null,
		systemOperation: "queue.email.send",
		correlationId: "corr-job",
		databaseRole: "app_runtime",
		...overrides,
	};
}

function pageRows(changes: readonly DataChangeLogSummaryRow[]): AuditTrailPageRows {
	return {
		requests: new Map([[REQUEST_ID, REQUEST]]),
		changes: new Map(changes.map((row): [string, DataChangeLogSummaryRow] => [row.id, row])),
		summaries: new Map([
			["corr-request", { changeCount: 2, changedTables: ["User"] }],
			["corr-job", { changeCount: 3, changedTables: ["email_jobs", "outbox_targets"] }],
		]),
		references: toAuditLogReferences([{ id: ACTOR_ID, email: "user@example.com", fullName: "Demo Customer" }], [{ id: TENANT_ID, displayName: "Kopi Corner" }]),
	};
}

describe("toAuditTrailEntry", () => {
	it("maps a request with the rows it changed", () => {
		expect(toAuditTrailEntry({ kind: "REQUEST", id: REQUEST_ID, occurredAt: OCCURRED_AT }, pageRows([]))).toMatchObject({
			kind: "REQUEST",
			method: "PATCH",
			actor: { fullName: "Demo Customer" },
			tenant: { name: "Kopi Corner" },
			changeCount: 2,
			changedTables: ["User"],
		});
	});

	it("reports a request that changed nothing as zero changes", () => {
		const rows: AuditTrailPageRows = { ...pageRows([]), summaries: new Map() };

		expect(toAuditTrailEntry({ kind: "REQUEST", id: REQUEST_ID, occurredAt: OCCURRED_AT }, rows)).toMatchObject({ changeCount: 0, changedTables: [] });
	});

	it("maps a background job with its whole group's summary", () => {
		expect(toAuditTrailEntry({ kind: "BACKGROUND", id: CHANGE_ID, occurredAt: OCCURRED_AT }, pageRows([change()]))).toEqual({
			kind: "BACKGROUND",
			id: CHANGE_ID,
			occurredAt: OCCURRED_AT + 60_000,
			actorKind: "SYSTEM",
			actor: null,
			tenant: null,
			apiKeyId: null,
			systemOperation: "queue.email.send",
			correlationId: "corr-job",
			databaseRole: "app_runtime",
			operation: "UPDATE",
			rowId: "row-1",
			changeCount: 3,
			changedTables: ["email_jobs", "outbox_targets"],
		});
	});

	it("groups uncorrelated changes (a manual SQL session) by their database transaction", () => {
		const lone = change({ correlationId: null, actorKind: "UNATTRIBUTED", systemOperation: null, databaseRole: "postgres" });
		const rows: AuditTrailPageRows = { ...pageRows([lone]), summaries: new Map([["tx:77", { changeCount: 500, changedTables: ["outbox_targets"] }]]) };

		expect(toAuditTrailEntry({ kind: "BACKGROUND", id: CHANGE_ID, occurredAt: OCCURRED_AT }, rows)).toMatchObject({
			changeCount: 500,
			changedTables: ["outbox_targets"],
			actorKind: "UNATTRIBUTED",
		});
	});

	it("drops a position whose record is missing rather than inventing one", () => {
		expect(toAuditTrailEntry({ kind: "BACKGROUND", id: "77777777-7777-4777-8777-777777777777", occurredAt: OCCURRED_AT }, pageRows([]))).toBeNull();
	});
});

describe("page references", () => {
	it("collects the change groups and names a page needs, once each", () => {
		const rows = [change(), change({ id: "x", correlationId: null, actorUserId: ACTOR_ID }), change({ id: "y", correlationId: null })];

		expect(auditTrailChangeGroups([REQUEST], rows)).toEqual({ correlationIds: ["corr-request", "corr-job"], transactionIds: [BigInt(77)] });
		expect(auditTrailReferenceIds([REQUEST], rows)).toEqual({ userIds: [ACTOR_ID], tenantIds: [TENANT_ID] });
	});
});
