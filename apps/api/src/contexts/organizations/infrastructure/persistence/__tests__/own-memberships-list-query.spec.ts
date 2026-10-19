import { buildOwnMembershipListOrder, buildOwnMembershipListWhere } from "../prisma-own-memberships.read-repository";

const USER_ID = "0199a1b2-0000-7000-8000-000000000002";

describe("own membership list query → Prisma", () => {
	it("lists the user's live ACTIVE memberships of live organizations", () => {
		expect(buildOwnMembershipListWhere(USER_ID, { page: 1, limit: 20 })).toEqual({ userId: USER_ID, status: "ACTIVE", isDeleted: false, organization: { isDeleted: false } });
	});

	it("searches the organization's name or slug, case-insensitively", () => {
		expect(buildOwnMembershipListWhere(USER_ID, { page: 1, limit: 20, search: "brew" }).organization).toEqual({
			isDeleted: false,
			OR: [{ displayName: { contains: "brew", mode: "insensitive" } }, { slug: { contains: "brew", mode: "insensitive" } }],
		});
	});

	it("orders by join date by default and by the organization's name on request", () => {
		expect(buildOwnMembershipListOrder({ page: 1, limit: 20 })).toMatchObject({ orderBy: [{ createdAt: "asc" }, { id: "asc" }], isDefault: true });
		expect(buildOwnMembershipListOrder({ page: 1, limit: 20, sort: "displayName" })).toMatchObject({
			orderBy: [{ organization: { displayName: "asc" } }, { id: "asc" }],
			isDefault: false,
		});
	});
});
