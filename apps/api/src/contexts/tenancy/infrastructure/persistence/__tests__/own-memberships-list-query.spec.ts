import { buildOwnMembershipListOrder, buildOwnMembershipListWhere } from "../prisma-own-memberships.read-repository";

const USER_ID = "0199a1b2-0000-7000-8000-000000000002";

describe("own membership list query → Prisma", () => {
	it("lists the user's live ACTIVE memberships of live tenants", () => {
		expect(buildOwnMembershipListWhere(USER_ID, { page: 1, limit: 20 })).toEqual({ userId: USER_ID, status: "ACTIVE", isDeleted: false, tenant: { isDeleted: false } });
	});

	it("searches the tenant's name or slug, case-insensitively", () => {
		expect(buildOwnMembershipListWhere(USER_ID, { page: 1, limit: 20, search: "brew" }).tenant).toEqual({
			isDeleted: false,
			OR: [{ displayName: { contains: "brew", mode: "insensitive" } }, { slug: { contains: "brew", mode: "insensitive" } }],
		});
	});

	it("orders by join date by default and by the tenant's name on request", () => {
		expect(buildOwnMembershipListOrder({ page: 1, limit: 20 })).toMatchObject({ orderBy: [{ createdAt: "asc" }, { id: "asc" }], isDefault: true });
		expect(buildOwnMembershipListOrder({ page: 1, limit: 20, sort: "displayName" })).toMatchObject({
			orderBy: [{ tenant: { displayName: "asc" } }, { id: "asc" }],
			isDefault: false,
		});
	});
});
