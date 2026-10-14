import { AuditTrailListQuerySchema, type AuditTrailListQuery } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { backgroundEntryConditions, buildAuditTrailOrder, buildAuditTrailTimeline, dataChangeGroupKey, requestEntryConditions } from "./audit-trail.repository";

const ACTOR_ID = "11111111-1111-4111-8111-111111111111";

/** The query string as Fastify parses it. */
type RawQuery = Readonly<Record<string, string | Readonly<Record<string, Readonly<Record<string, string>>>>>>;

function query(input: RawQuery): AuditTrailListQuery {
	return AuditTrailListQuerySchema.parse(input);
}

/** PostgreSQL text with the numbered placeholders, whitespace collapsed — what the assertions read. */
function sqlText(fragment: { readonly text: string }): string {
	return fragment.text.replace(/\s+/g, " ").trim();
}

describe("requestEntryConditions", () => {
	it("is unconditional without filters", () => {
		expect(sqlText(requestEntryConditions(query({})))).toBe("TRUE");
	});

	it("binds every shared and request-only filter as a parameter, never as text", () => {
		const conditions = requestEntryConditions(query({ filter: { actorUserId: { eq: ACTOR_ID }, outcome: { eq: "FAILED" }, method: { eq: "DELETE" } } }));

		expect(sqlText(conditions)).toBe('a.actor_user_id = $1 AND a.outcome = $2::"AuditOutcome" AND a.method = $3');
		expect(conditions.values).toEqual([ACTOR_ID, "FAILED", "DELETE"]);
	});

	it("keeps the requests that changed a given row", () => {
		const conditions = requestEntryConditions(query({ filter: { tableName: { eq: "users" }, rowId: { eq: ACTOR_ID } } }));

		expect(sqlText(conditions)).toBe("EXISTS (SELECT 1 FROM public.data_change_logs d WHERE d.correlation_id = a.correlation_id AND d.table_name = $1 AND d.row_id = $2)");
	});

	it("matches the search literally — LIKE wildcards in it are escaped", () => {
		expect(requestEntryConditions(query({ search: "50%_off" })).values).toEqual(["%50\\%\\_off%", "%50\\%\\_off%", "50%_off"]);
	});

	it("excludes every request when the query asks for background entries", () => {
		expect(sqlText(requestEntryConditions(query({ filter: { kind: { eq: "BACKGROUND" } } })))).toBe("FALSE");
		expect(sqlText(requestEntryConditions(query({ filter: { actorKind: { eq: "UNATTRIBUTED" } } })))).toBe("FALSE");
	});
});

describe("backgroundEntryConditions", () => {
	it("only ever takes changes no HTTP request made", () => {
		expect(sqlText(backgroundEntryConditions(query({}))?.rows ?? { text: "" })).toBe(
			"NOT EXISTS (SELECT 1 FROM public.audit_logs a WHERE a.correlation_id = d.correlation_id)",
		);
	});

	it("keeps a job whole when any of its changes touched the row (HAVING, not WHERE)", () => {
		const conditions = backgroundEntryConditions(query({ filter: { tableName: { eq: "users" }, actorKind: { eq: "SYSTEM" } } }));

		expect(sqlText(conditions?.rows ?? { text: "" })).toContain('d.actor_kind = $1::"DataChangeActorKind"');
		expect(sqlText(conditions?.groups ?? { text: "" })).toBe("bool_or(d.table_name = $1)");
	});

	it("is absent when the query asks for requests, or filters by something only requests have", () => {
		expect(backgroundEntryConditions(query({ filter: { kind: { eq: "REQUEST" } } }))).toBeNull();
		expect(backgroundEntryConditions(query({ filter: { deviceType: { eq: "MOBILE" } } }))).toBeNull();
	});
});

describe("buildAuditTrailTimeline", () => {
	it("unions the requests with the grouped background changes", () => {
		const timeline = sqlText(buildAuditTrailTimeline(query({})));

		expect(timeline).toContain("FROM public.audit_logs a WHERE TRUE UNION ALL SELECT 'BACKGROUND'::text AS kind");
		expect(timeline).toContain("GROUP BY COALESCE(d.correlation_id, $1 || d.transaction_id::text)");
	});

	it("is the requests alone when background entries are excluded", () => {
		expect(sqlText(buildAuditTrailTimeline(query({ filter: { kind: { eq: "REQUEST" } } })))).not.toContain("UNION ALL");
	});
});

describe("buildAuditTrailOrder", () => {
	it("defaults to newest first with the entry id as tie-breaker, and sorts oldest first on request", () => {
		expect(buildAuditTrailOrder(query({})).orderBy.map(sqlText)).toEqual(["t.occurred_at DESC", "t.id DESC"]);
		expect(buildAuditTrailOrder(query({ sort: "occurredAt" })).orderBy.map(sqlText)).toEqual(["t.occurred_at ASC", "t.id ASC"]);
	});
});

describe("dataChangeGroupKey", () => {
	it("groups by correlation id, else by database transaction", () => {
		expect(dataChangeGroupKey({ correlationId: "job-1", transactionId: BigInt(5) })).toBe("job-1");
		expect(dataChangeGroupKey({ correlationId: null, transactionId: BigInt(5) })).toBe("tx:5");
	});
});
