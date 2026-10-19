import { PermissionListQuerySchema, RoleListQuerySchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { GRANTS_URL_STATE, PERMISSION_LIST_PAGE_SIZE, PERMISSIONS_URL_STATE, ROLE_LIST_PAGE_SIZE, ROLES_URL_STATE, toPermissionsQuery, toRolesQuery } from "../access";

describe("access url state", () => {
	it("reads each list's page from its own keys", () => {
		const search = { rolesPage: "2", permissionsPage: "3", grantsPage: "4" };
		expect(toRolesQuery(ROLES_URL_STATE.parse(search))).toEqual({ page: 2, limit: ROLE_LIST_PAGE_SIZE });
		expect(toPermissionsQuery(PERMISSIONS_URL_STATE.parse(search))).toEqual({ page: 3, limit: PERMISSION_LIST_PAGE_SIZE });
		expect(toPermissionsQuery(GRANTS_URL_STATE.parse(search))).toEqual({ page: 4, limit: PERMISSION_LIST_PAGE_SIZE });
	});

	it("falls back to the first page in the default order, and the API accepts the input", () => {
		const roles = toRolesQuery(ROLES_URL_STATE.parse({ rolesPage: "x", rolesSort: "password" }));
		expect(roles).toEqual({ page: 1, limit: ROLE_LIST_PAGE_SIZE });
		expect(RoleListQuerySchema.safeParse(roles).success).toBe(true);
		expect(PermissionListQuerySchema.safeParse(toPermissionsQuery(PERMISSIONS_URL_STATE.parse({}))).success).toBe(true);
	});

	it("keeps a requested sort", () => {
		expect(toRolesQuery(ROLES_URL_STATE.parse({ rolesSort: "-createdAt" }))).toEqual({ page: 1, limit: ROLE_LIST_PAGE_SIZE, sort: "-createdAt" });
	});
});
