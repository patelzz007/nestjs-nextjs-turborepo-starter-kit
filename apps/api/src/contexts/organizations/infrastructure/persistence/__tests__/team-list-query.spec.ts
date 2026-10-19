import { buildInviteListOrder, buildMemberListOrder, buildMemberListWhere } from "../prisma-team.read-repository";

const ORGANIZATION_ID = "0199a1b2-0000-7000-8000-000000000001";

describe("member roster list query → Prisma", () => {
	it("scopes to the organization's live memberships and adds the role filter", () => {
		expect(buildMemberListWhere(ORGANIZATION_ID, { page: 1, limit: 20 })).toEqual({ AND: [{ organizationId: ORGANIZATION_ID, isDeleted: false }] });
		expect(buildMemberListWhere(ORGANIZATION_ID, { page: 1, limit: 20, filter: { role: { in: ["ADMIN", "CASHIER"] } } })).toEqual({
			AND: [{ organizationId: ORGANIZATION_ID, isDeleted: false }, { role: { in: ["ADMIN", "CASHIER"] } }],
		});
	});

	it("orders by join date (oldest first) by default, always with the id tie-breaker", () => {
		expect(buildMemberListOrder({ page: 1, limit: 20 })).toMatchObject({ orderBy: [{ createdAt: "asc" }, { id: "asc" }], isDefault: true });
		expect(buildMemberListOrder({ page: 1, limit: 20, sort: "role,-createdAt" })).toMatchObject({
			orderBy: [{ role: "asc" }, { createdAt: "desc" }, { id: "desc" }],
			isDefault: false,
		});
	});
});

describe("pending invite list query → Prisma", () => {
	it("orders newest first by default and by expiry on request", () => {
		expect(buildInviteListOrder({ page: 1, limit: 20 })).toMatchObject({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], isDefault: true });
		expect(buildInviteListOrder({ page: 1, limit: 20, sort: "expiresAt" })).toMatchObject({ orderBy: [{ expiresAt: "asc" }, { id: "asc" }], isDefault: false });
	});
});
