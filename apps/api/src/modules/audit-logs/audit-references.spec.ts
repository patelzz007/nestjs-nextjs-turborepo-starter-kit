import { describe, expect, it } from "vitest";

import { distinctReferenceIds, toAuditLogOrganization, toAuditLogReferences, toAuditLogUser } from "./audit-references";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ORGANIZATION_ID = "33333333-3333-4333-8333-333333333333";
const GONE_ID = "44444444-4444-4444-8444-444444444444";

const REFERENCES = toAuditLogReferences([{ id: USER_ID, email: "admin@example.com", fullName: "Admin" }], [{ id: ORGANIZATION_ID, displayName: "Kopi Corner" }]);

describe("distinctReferenceIds", () => {
	it("drops nulls and duplicates, keeping first-seen order", () => {
		expect(distinctReferenceIds([GONE_ID, null, USER_ID, GONE_ID])).toEqual([GONE_ID, USER_ID]);
	});
});

describe("toAuditLogUser", () => {
	it("resolves a known user", () => {
		expect(toAuditLogUser(USER_ID, REFERENCES)).toEqual({ id: USER_ID, email: "admin@example.com", fullName: "Admin" });
	});

	it("keeps the id of a user that no longer resolves — the id is the forensic fact", () => {
		expect(toAuditLogUser(GONE_ID, REFERENCES)).toEqual({ id: GONE_ID, email: null, fullName: null });
	});

	it("is null when the record names no user", () => {
		expect(toAuditLogUser(null, REFERENCES)).toBeNull();
	});
});

describe("toAuditLogOrganization", () => {
	it("resolves a known organization and keeps an unknown one's id", () => {
		expect(toAuditLogOrganization(ORGANIZATION_ID, REFERENCES)).toEqual({ id: ORGANIZATION_ID, name: "Kopi Corner" });
		expect(toAuditLogOrganization(GONE_ID, REFERENCES)).toEqual({ id: GONE_ID, name: null });
		expect(toAuditLogOrganization(null, REFERENCES)).toBeNull();
	});
});
