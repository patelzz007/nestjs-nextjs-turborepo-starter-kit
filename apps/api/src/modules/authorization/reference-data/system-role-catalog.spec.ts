import { getPermissionDefinitions } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { ADMIN_ROLE_NAME, DEFAULT_CONSUMER_ROLE_NAME, SUPER_ADMIN_ROLE_NAME } from "../constants/authorization.constants";
import { SYSTEM_ROLE_CATALOG, type PermissionKey } from "./system-role-catalog";

const CATALOG: readonly PermissionKey[] = getPermissionDefinitions().map((definition): PermissionKey => ({
	action: definition.action,
	resource: definition.resource,
	scope: definition.scope ?? "GLOBAL",
}));

function grantsOf(roleName: string): PermissionKey[] {
	const role = SYSTEM_ROLE_CATALOG.find((definition) => definition.name === roleName);
	if (role === undefined) {
		throw new Error(`no system role ${roleName}`);
	}
	return CATALOG.filter(role.grants);
}

function keys(permissions: readonly PermissionKey[]): Set<string> {
	return new Set(permissions.map((permission) => `${permission.action}:${permission.resource}:${permission.scope}`));
}

describe("SYSTEM_ROLE_CATALOG", () => {
	it("has unique role names and includes every role the code looks up by name", () => {
		const names = SYSTEM_ROLE_CATALOG.map((role) => role.name);

		expect(new Set(names).size).toBe(names.length);
		expect(names).toEqual(expect.arrayContaining([SUPER_ADMIN_ROLE_NAME, ADMIN_ROLE_NAME, DEFAULT_CONSUMER_ROLE_NAME, "Store Manager", "Store Staff"]));
	});

	it("grants every role at least one permission, and only permissions that exist in the catalog", () => {
		for (const role of SYSTEM_ROLE_CATALOG) {
			expect(grantsOf(role.name).length).toBeGreaterThan(0);
		}
	});

	it("gives SuperAdmin the whole catalog", () => {
		expect(grantsOf("SuperAdmin")).toHaveLength(CATALOG.length);
	});

	it("keeps the customer role OWN-scoped and out of the admin panel", () => {
		const user = grantsOf("User");

		expect(user.every((permission) => permission.scope === "OWN")).toBe(true);
		expect(user.some((permission) => permission.resource === "ADMIN_DASHBOARD")).toBe(false);
	});

	it("withholds RBAC, system settings and the two direct-grant permissions from Manager and Admin as documented", () => {
		expect(grantsOf("Manager").some((permission) => permission.resource === "ROLE" || permission.resource === "SYSTEM_SETTINGS")).toBe(false);
		expect(keys(grantsOf("Admin")).has("DELETE:USER:GLOBAL")).toBe(false);
		expect(keys(grantsOf("Admin")).has("MANAGE:SYSTEM_SETTINGS:GLOBAL")).toBe(false);
	});

	it("makes Store Staff a subset of Store Manager, both STORE-scoped", () => {
		const manager = keys(grantsOf("Store Manager"));
		const staff = grantsOf("Store Staff");

		expect(staff.every((permission) => permission.scope === "STORE" && manager.has(`${permission.action}:${permission.resource}:${permission.scope}`))).toBe(true);
	});
});
