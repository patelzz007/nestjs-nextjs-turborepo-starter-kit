import { getPermissionDefinitions } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { ADMIN_ROLE_NAME, DEFAULT_CONSUMER_ROLE_NAME, LOCATION_MANAGER_ROLE_NAME, LOCATION_STAFF_ROLE_NAME, SUPER_ADMIN_ROLE_NAME } from "../../../domain/rbac-catalog";
import { SYSTEM_ROLE_CATALOG, type PermissionKey } from "../system-role-catalog";

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
		expect(names).toEqual(expect.arrayContaining([SUPER_ADMIN_ROLE_NAME, ADMIN_ROLE_NAME, DEFAULT_CONSUMER_ROLE_NAME, LOCATION_MANAGER_ROLE_NAME, LOCATION_STAFF_ROLE_NAME]));
	});

	it("grants every role at least one permission, and only permissions that exist in the catalog", () => {
		for (const role of SYSTEM_ROLE_CATALOG) {
			expect(grantsOf(role.name).length).toBeGreaterThan(0);
		}
	});

	it("gives SuperAdmin the whole catalog", () => {
		expect(grantsOf("SuperAdmin")).toHaveLength(CATALOG.length);
	});

	it("keeps the customer role OWN-scoped, apart from the documented shared reads, and out of the admin panel", () => {
		const user = grantsOf("User");
		const shared = user.filter((permission) => permission.scope !== "OWN");

		expect([...keys(shared)]).toEqual(["READ:GITHUB:GLOBAL"]);
		expect(user.some((permission) => permission.resource === "ADMIN_DASHBOARD")).toBe(false);
	});

	it("lets every platform role read the configured GitHub repositories", () => {
		for (const roleName of ["SuperAdmin", "Admin", "Manager", "User"]) {
			expect(keys(grantsOf(roleName)).has("READ:GITHUB:GLOBAL"), roleName).toBe(true);
		}
	});

	it("withholds RBAC, system settings and the two direct-grant permissions from Manager and Admin as documented", () => {
		expect(grantsOf("Manager").some((permission) => permission.resource === "ROLE" || permission.resource === "SYSTEM_SETTINGS")).toBe(false);
		expect(keys(grantsOf("Admin")).has("DELETE:USER:GLOBAL")).toBe(false);
		expect(keys(grantsOf("Admin")).has("MANAGE:SYSTEM_SETTINGS:GLOBAL")).toBe(false);
	});

	it("gives Admin the whole kanban board and Manager every board action except deleting tasks and rearranging columns", () => {
		const kanbanOf = (roleName: string): string[] => [...keys(grantsOf(roleName).filter((permission) => permission.resource === "KANBAN_TASK"))].sort();

		expect(kanbanOf("Admin")).toEqual([
			"CREATE:KANBAN_TASK:GLOBAL",
			"DELETE:KANBAN_TASK:GLOBAL",
			"LIST:KANBAN_TASK:GLOBAL",
			"MANAGE:KANBAN_TASK:GLOBAL",
			"READ:KANBAN_TASK:GLOBAL",
			"UPDATE:KANBAN_TASK:GLOBAL",
		]);
		expect(kanbanOf("Manager")).toEqual(["CREATE:KANBAN_TASK:GLOBAL", "LIST:KANBAN_TASK:GLOBAL", "READ:KANBAN_TASK:GLOBAL", "UPDATE:KANBAN_TASK:GLOBAL"]);
		expect(kanbanOf("User")).toEqual([]);
	});

	it("makes Location Staff a subset of Location Manager, both only LOCATION-scoped", () => {
		const manager = grantsOf(LOCATION_MANAGER_ROLE_NAME);
		const managerKeys = keys(manager);
		const staff = grantsOf(LOCATION_STAFF_ROLE_NAME);

		expect(manager.every((permission) => permission.scope === "LOCATION")).toBe(true);
		expect(staff.every((permission) => permission.scope === "LOCATION" && managerKeys.has(`${permission.action}:${permission.resource}:${permission.scope}`))).toBe(true);
	});
});
