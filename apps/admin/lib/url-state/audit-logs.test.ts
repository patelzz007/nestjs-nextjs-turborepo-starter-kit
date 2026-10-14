import { AuditTrailListQuerySchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { AUDIT_LOG_PAGE_SIZE, AUDIT_LOG_URL_STATE, auditLogListHref, isAuditLogFiltered, toAuditLogListQuery } from "./audit-logs";
import { AUDIT_LOG_RECORD_URL_STATE, DATA_CHANGE_RECORD_URL_STATE } from "./selection";

const ACTOR_ID = "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const ORGANIZATION_ID = "7a2d3b63-0b4f-4e49-8b66-1e2f3a4b5c6d";

describe("audit log URL state", () => {
	it("maps a full URL to the API input the list schema accepts", () => {
		const input = toAuditLogListQuery(
			AUDIT_LOG_URL_STATE.parse({
				page: "3",
				sort: "occurredAt",
				search: "203.0.113",
				"filter[outcome]": "FAILED",
				"filter[method]": "DELETE",
				"filter[authMethod]": "BEARER_TOKEN",
				"filter[actorUserId]": ACTOR_ID,
				"filter[organizationId]": ORGANIZATION_ID,
				"filter[correlationId]": "corr-123",
			}),
		);

		expect(input).toEqual({
			page: 3,
			limit: AUDIT_LOG_PAGE_SIZE,
			sort: "occurredAt",
			search: "203.0.113",
			filter: {
				outcome: { eq: "FAILED" },
				method: { eq: "DELETE" },
				authMethod: { eq: "BEARER_TOKEN" },
				actorUserId: { eq: ACTOR_ID },
				organizationId: { eq: ORGANIZATION_ID },
				correlationId: { eq: "corr-123" },
			},
		});
		expect(AuditTrailListQuerySchema.safeParse(input).success).toBe(true);
	});

	it("drops hostile or unknown values instead of sending them to the API", () => {
		const input = toAuditLogListQuery(
			AUDIT_LOG_URL_STATE.parse({
				page: "x",
				limit: "100000",
				sort: "requestBody",
				"filter[outcome]": "MAYBE",
				"filter[method]": "TRACE",
				"filter[actorUserId]": "not-a-uuid",
			}),
		);

		expect(input).toEqual({ page: 1, limit: AUDIT_LOG_PAGE_SIZE });
	});

	it("omits the default page size from the URL", () => {
		expect(AUDIT_LOG_URL_STATE.serialize(AUDIT_LOG_URL_STATE.parse({ limit: String(AUDIT_LOG_PAGE_SIZE) }))).toBe("");
	});

	it("knows when a search or any filter narrows the table", () => {
		expect(isAuditLogFiltered(AUDIT_LOG_URL_STATE.defaults)).toBe(false);
		expect(isAuditLogFiltered({ ...AUDIT_LOG_URL_STATE.defaults, outcome: "FAILED" })).toBe(true);
		expect(isAuditLogFiltered({ ...AUDIT_LOG_URL_STATE.defaults, correlationId: "corr-1" })).toBe(true);
		expect(isAuditLogFiltered({ ...AUDIT_LOG_URL_STATE.defaults, search: "login" })).toBe(true);
	});
});

describe("auditLogListHref", () => {
	it("links to the table filtered by one actor, organization or correlation id", () => {
		expect(auditLogListHref({ actorUserId: ACTOR_ID })).toBe(`/audit-logs?filter[actorUserId]=${ACTOR_ID}`);
		expect(auditLogListHref({ organizationId: ORGANIZATION_ID })).toBe(`/audit-logs?filter[organizationId]=${ORGANIZATION_ID}`);
		expect(auditLogListHref({ correlationId: "corr-1" })).toBe("/audit-logs?filter[correlationId]=corr-1");
	});

	it("links to the unfiltered table without a query", () => {
		expect(auditLogListHref({})).toBe("/audit-logs");
	});

	it("round-trips: the linked URL parses back to the same filter", () => {
		const [, query = ""] = auditLogListHref({ actorUserId: ACTOR_ID }).split("?");

		expect(AUDIT_LOG_URL_STATE.parse(new URLSearchParams(query)).actorUserId).toBe(ACTOR_ID);
	});
});

describe("audit log device / network filters and the drawer selection", () => {
	const RECORD_ID = "55555555-5555-4555-8555-555555555555";

	it("maps the device and address-class filters", () => {
		const input = toAuditLogListQuery(AUDIT_LOG_URL_STATE.parse({ "filter[deviceType]": "MOBILE", "filter[ipScope]": "PRIVATE" }));

		expect(input).toEqual({ page: 1, limit: AUDIT_LOG_PAGE_SIZE, filter: { deviceType: { eq: "MOBILE" }, ipScope: { eq: "PRIVATE" } } });
		expect(AuditTrailListQuerySchema.safeParse(input).success).toBe(true);
		expect(isAuditLogFiltered(AUDIT_LOG_URL_STATE.parse({ "filter[deviceType]": "BOT" }))).toBe(true);
	});

	it("keeps the open record out of the table's query (it is its own param)", () => {
		const params = { page: "2", record: RECORD_ID };

		expect(AUDIT_LOG_RECORD_URL_STATE.parse(params).record).toBe(RECORD_ID);
		expect(toAuditLogListQuery(AUDIT_LOG_URL_STATE.parse(params))).toEqual({ page: 2, limit: AUDIT_LOG_PAGE_SIZE });
	});

	it("drops a record param that is not a record id", () => {
		expect(AUDIT_LOG_RECORD_URL_STATE.parse({ record: "not-an-id" }).record).toBeUndefined();
	});
});

describe("audit log timeline filters (requests + background writes)", () => {
	it("maps the source, attribution and row-history filters", () => {
		const input = toAuditLogListQuery(
			AUDIT_LOG_URL_STATE.parse({ "filter[kind]": "BACKGROUND", "filter[actorKind]": "UNATTRIBUTED", "filter[tableName]": "users", "filter[rowId]": ACTOR_ID }),
		);

		expect(input).toEqual({
			page: 1,
			limit: AUDIT_LOG_PAGE_SIZE,
			filter: { kind: { eq: "BACKGROUND" }, actorKind: { eq: "UNATTRIBUTED" }, tableName: { eq: "users" }, rowId: { eq: ACTOR_ID } },
		});
		expect(AuditTrailListQuerySchema.safeParse(input).success).toBe(true);
	});

	it("links to one row's history", () => {
		expect(auditLogListHref({ tableName: "users", rowId: ACTOR_ID })).toBe(`/audit-logs?filter[tableName]=users&filter[rowId]=${ACTOR_ID}`);
	});

	it("sorts by time only — a column sort of the old request-only table is dropped, not sent", () => {
		expect(toAuditLogListQuery(AUDIT_LOG_URL_STATE.parse({ sort: "-responseStatus" }))).toEqual({ page: 1, limit: AUDIT_LOG_PAGE_SIZE });
	});

	it("drops an unknown source", () => {
		expect(toAuditLogListQuery(AUDIT_LOG_URL_STATE.parse({ "filter[kind]": "EMAIL" }))).toEqual({ page: 1, limit: AUDIT_LOG_PAGE_SIZE });
	});

	it("keeps the open background change in its own param, apart from the request record", () => {
		expect(DATA_CHANGE_RECORD_URL_STATE.parse({ change: ACTOR_ID }).change).toBe(ACTOR_ID);
		expect(DATA_CHANGE_RECORD_URL_STATE.parse({ change: "nope" }).change).toBeUndefined();
	});
});
