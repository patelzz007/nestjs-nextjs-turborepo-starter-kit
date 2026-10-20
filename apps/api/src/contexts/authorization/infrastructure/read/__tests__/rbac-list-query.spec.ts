import { buildPermissionListOrder, buildPermissionListWhere, buildRoleListOrder, buildRoleListWhere } from "../prisma-rbac-catalog.reader";

describe("role list query → Prisma", () => {
	it("lists live roles, narrowed by isActive and the name search", () => {
		expect(buildRoleListWhere({ page: 1, limit: 20 })).toEqual({ AND: [{ isDeleted: false }] });
		expect(buildRoleListWhere({ page: 1, limit: 20, search: "edit", filter: { isActive: { eq: true } } })).toEqual({
			AND: [{ isDeleted: false }, { isActive: { equals: true } }, { name: { contains: "edit", mode: "insensitive" } }],
		});
	});

	it("orders by name by default, with the id tie-breaker", () => {
		expect(buildRoleListOrder({ page: 1, limit: 20 })).toMatchObject({ orderBy: [{ name: "asc" }, { id: "asc" }], isDefault: true });
	});
});

describe("permission list query → Prisma", () => {
	it("lists live permissions, narrowed by group, resource and the description search", () => {
		expect(buildPermissionListWhere({ page: 1, limit: 100, search: "audit", filter: { resource: { in: ["AUDIT_LOG"] } } })).toEqual({
			AND: [{ isDeleted: false }, { resource: { in: ["AUDIT_LOG"] } }, { description: { contains: "audit", mode: "insensitive" } }],
		});
	});

	it("orders by group (nulls last), resource and action, so a page holds whole groups", () => {
		expect(buildPermissionListOrder({ page: 1, limit: 100 })).toMatchObject({
			orderBy: [{ group: { sort: "asc", nulls: "last" } }, { resource: "asc" }, { action: "asc" }, { id: "asc" }],
			isDefault: true,
		});
	});
});
