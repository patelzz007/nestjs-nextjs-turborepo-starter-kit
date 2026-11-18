import { describe, expect, it } from "vitest";

import { explainTable } from "../explain";
import { TABLE_POLICIES } from "../table-policies";

describe("explainTable", () => {
	it("says who may do what, per policy, with the permission and columns it checks", () => {
		const lines = explainTable({ table: "Membership", policies: TABLE_POLICIES.Membership, withheld: [] });
		expect(lines).toContain("  tenant_memberships_read [read, every role]");
		expect(lines).toContain(`    holders of the permission (role or grant), or system (read) — permission member.read; column "tenantId"`);
		expect(lines).toContain("  tenant_memberships_own_read [read, every role]");
		expect(lines.some((line) => line.includes("[update"))).toBe(false);
		expect(lines).toContain("A row is reachable when ANY policy above admits it.");
	});

	it("names the withheld privileges and other roles' grants", () => {
		const lines = explainTable({ table: "AnalyticsEvent", policies: TABLE_POLICIES.AnalyticsEvent, withheld: ["DELETE"] });
		expect(lines).toContain("app_runtime may never: DELETE (withheld-privileges.ts).");
		expect(lines).toContain("  analytics_consumer: SELECT (id)");
		expect(lines).toContain("  analytics_events_bypass [read + write, app_runtime]");
	});

	it("says when nobody but the owner may touch a table", () => {
		expect(explainTable({ table: "Note", policies: [], withheld: [] })).toContain("  No policy: nobody but the table owner may read or write it.");
	});
});
