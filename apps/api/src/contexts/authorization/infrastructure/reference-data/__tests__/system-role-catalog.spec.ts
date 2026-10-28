import { getPermissionDefinitions, isTenantPermission, MembershipRoleSchema, TENANT_ROLE_TEMPLATE_NAMES, TENANT_ROLE_TEMPLATES } from "@workspace/shared";
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
		for (const roleName of ["SuperAdmin", "Admin", "User"]) {
			expect(keys(grantsOf(roleName)).has("READ:GITHUB:GLOBAL"), roleName).toBe(true);
		}
	});

	it("withholds the two direct-grant permissions from Admin as documented", () => {
		expect(keys(grantsOf("Admin")).has("DELETE:USER:GLOBAL")).toBe(false);
		expect(keys(grantsOf("Admin")).has("MANAGE:SYSTEM_SETTINGS:GLOBAL")).toBe(false);
	});

	it("defines one tenant-role template per tenant role, holding exactly its template's GLOBAL permissions (ADR 067)", () => {
		for (const template of MembershipRoleSchema.options) {
			const definition = SYSTEM_ROLE_CATALOG.find((role) => role.template === template);
			const expected = TENANT_ROLE_TEMPLATES[template].map((permission) => `${permission.action}:${permission.resource}:GLOBAL`);

			expect(definition?.name).toBe(TENANT_ROLE_TEMPLATE_NAMES[template]);
			expect([...keys(grantsOf(TENANT_ROLE_TEMPLATE_NAMES[template]))].sort()).toEqual([...expected].sort());
			expect(grantsOf(TENANT_ROLE_TEMPLATE_NAMES[template]).every((permission) => isTenantPermission(permission))).toBe(true);
		}
	});

	it("keeps platform roles free of templates: no platform role is named like a tenant role", () => {
		const platformNames = SYSTEM_ROLE_CATALOG.filter((role) => role.template === undefined).map((role) => role.name);

		expect(platformNames.filter((name) => Object.values(TENANT_ROLE_TEMPLATE_NAMES).includes(name))).toEqual([]);
	});

	it("gives Admin the whole kanban board and the customer none of it", () => {
		const kanbanOf = (roleName: string): string[] =>
			[...keys(grantsOf(roleName).filter((permission) => permission.resource === "KANBAN_TASK" || permission.resource === "KANBAN_BOARD"))].sort();

		expect(kanbanOf("Admin")).toEqual([
			"CREATE:KANBAN_TASK:GLOBAL",
			"DELETE:KANBAN_TASK:GLOBAL",
			"LIST:KANBAN_TASK:GLOBAL",
			"READ:KANBAN_TASK:GLOBAL",
			"UPDATE:KANBAN_BOARD:GLOBAL",
			"UPDATE:KANBAN_TASK:GLOBAL",
		]);
		expect(kanbanOf("User")).toEqual([]);
	});

	it("gives Admin the precise moderation and lifecycle verbs, never banning (SuperAdmin only)", () => {
		const of = (resource: string): string[] => [...keys(grantsOf("Admin").filter((permission) => permission.resource === resource))].sort();

		expect(of("REWARD")).toEqual(expect.arrayContaining(["APPROVE:REWARD:GLOBAL", "REJECT:REWARD:GLOBAL"]));
		expect(of("MERCHANT_ORG")).toEqual(
			expect.arrayContaining(["APPROVE:MERCHANT_ORG:GLOBAL", "REJECT:MERCHANT_ORG:GLOBAL", "SUSPEND:MERCHANT_ORG:GLOBAL", "REACTIVATE:MERCHANT_ORG:GLOBAL"]),
		);
		expect(of("MERCHANT_ORG")).not.toEqual(expect.arrayContaining(["BAN:MERCHANT_ORG:GLOBAL"]));
		expect(of("MERCHANT_ORG")).not.toEqual(expect.arrayContaining(["UNBAN:MERCHANT_ORG:GLOBAL"]));
	});

	it("makes Location Staff a subset of Location Manager, both only LOCATION-scoped", () => {
		const manager = grantsOf(LOCATION_MANAGER_ROLE_NAME);
		const managerKeys = keys(manager);
		const staff = grantsOf(LOCATION_STAFF_ROLE_NAME);

		expect(manager.every((permission) => permission.scope === "LOCATION")).toBe(true);
		expect(staff.every((permission) => permission.scope === "LOCATION" && managerKeys.has(`${permission.action}:${permission.resource}:${permission.scope}`))).toBe(true);
	});
});
