import { describe, expect, it } from "vitest";

import { AccessDeniedError, ProtectedRoleWithoutHolderError, SeparationOfDutyViolationError } from "../errors/authorization.errors";
import { assertProtectedRolesKeepAHolder } from "../policies/protected-role-holder.policy";
import {
	assertCanManageAccount,
	assertHoldsEveryPermission,
	assertNotHoldingRole,
	assertNotSelf,
	distinctPermissionPairs,
	needsReachCheck,
} from "../policies/rbac-escalation.policy";
import { assertSeparationOfDuties, findSeparationOfDutyViolations } from "../policies/separation-of-duties.policy";
import { permissionKeyOf } from "../rbac-catalog";

const ADMIN = { userId: "admin-1", isSuperAdmin: false };
const SUPER = { userId: "root-1", isSuperAdmin: true };

describe("RBAC escalation policy", () => {
	it("checks reach for every administrator except a SuperAdmin", () => {
		expect(needsReachCheck(ADMIN)).toBe(true);
		expect(needsReachCheck(SUPER)).toBe(false);
	});

	it("forbids an administrator to change their own grants, or a SuperAdmin's", () => {
		expect(() => {
			assertNotSelf(ADMIN, "admin-1");
		}).toThrow(AccessDeniedError);
		expect(() => {
			assertNotSelf(SUPER, "root-1");
		}).not.toThrow();
		expect(() => {
			assertCanManageAccount(ADMIN, { userId: "root-2", isSuperAdmin: true });
		}).toThrow(AccessDeniedError);
		expect(() => {
			assertCanManageAccount(ADMIN, { userId: "user-1", isSuperAdmin: false });
		}).not.toThrow();
	});

	it("forbids handing out a role in the administrator's own lineage", () => {
		expect(() => {
			assertNotHoldingRole(ADMIN, new Set(["role-1"]), "role-1");
		}).toThrow(AccessDeniedError);
		expect(() => {
			assertNotHoldingRole(ADMIN, new Set(["role-1"]), "role-2");
		}).not.toThrow();
		expect(() => {
			assertNotHoldingRole(SUPER, new Set(["role-1"]), "role-1");
		}).not.toThrow();
	});

	it("allows granting only permissions the administrator holds globally (no escalation)", () => {
		const held = new Set([permissionKeyOf({ action: "READ", resource: "USER" })]);

		expect(() => {
			assertHoldsEveryPermission(ADMIN, [{ action: "READ", resource: "USER" }], held);
		}).not.toThrow();
		expect(() => {
			assertHoldsEveryPermission(ADMIN, [{ action: "DELETE", resource: "USER" }], held);
		}).toThrow(AccessDeniedError);
		expect(() => {
			assertHoldsEveryPermission(SUPER, [{ action: "DELETE", resource: "USER" }], new Set());
		}).not.toThrow();
	});

	it("de-duplicates the required pairs", () => {
		expect(
			distinctPermissionPairs([
				{ action: "READ", resource: "USER" },
				{ action: "READ", resource: "USER" },
				{ action: "READ", resource: "ROLE" },
			]),
		).toEqual([
			{ action: "READ", resource: "USER" },
			{ action: "READ", resource: "ROLE" },
		]);
	});
});

describe("Separation of duties", () => {
	it("flags the conflicting pair of location roles and lets compatible ones through", () => {
		expect(findSeparationOfDutyViolations(new Set(["Location Manager", "Location Staff"]))).toHaveLength(1);
		expect(() => {
			assertSeparationOfDuties(new Set(["Location Manager", "Location Staff"]));
		}).toThrow(SeparationOfDutyViolationError);
		expect(() => {
			assertSeparationOfDuties(new Set(["Location Manager", "Auditor"]));
		}).not.toThrow();
	});
});

describe("Last protected holder", () => {
	it("refuses a removal that leaves a protected role without an active holder", () => {
		const protectedRoles = [{ roleId: "role-super", roleName: "SuperAdmin", activeHolders: 0 }];

		expect(() => {
			assertProtectedRolesKeepAHolder(["role-super"], protectedRoles);
		}).toThrow(ProtectedRoleWithoutHolderError);
		expect(() => {
			assertProtectedRolesKeepAHolder(["role-other"], protectedRoles);
		}).not.toThrow();
		expect(() => {
			assertProtectedRolesKeepAHolder(["role-super"], [{ roleId: "role-super", roleName: "SuperAdmin", activeHolders: 1 }]);
		}).not.toThrow();
	});
});
