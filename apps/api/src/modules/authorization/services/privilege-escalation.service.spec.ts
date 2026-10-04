import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthorizationRequest } from "@workspace/shared";

import { NotFoundError } from "../../../common/errors/app-error";
import { AuthorizationException } from "../exceptions/authorization.exception";
import { PermissionRepository } from "../repositories/permission.repository";
import { RoleAssignmentRepository } from "../repositories/role-assignment.repository";
import { RoleRepository } from "../repositories/role.repository";
import { PrivilegeEscalationService, type AuthorizationActor } from "./privilege-escalation.service";
import { createTestAuthorizationKernel, createTestPrisma } from "../../../../test/support/test-service-graph";

interface RoleRow {
	readonly id: string;
	readonly parentId: string | null;
	readonly isDeleted: boolean;
	readonly isActive: boolean;
}

/** In-memory RBAC state the mocked repositories read (each mock honours its repository method's contract). */
const state = vi.hoisted(() => ({
	can: vi.fn(),
	roles: new Array<{ readonly id: string; readonly parentId: string | null; readonly isDeleted: boolean; readonly isActive: boolean }>(),
	rolePermissions: new Array<{ readonly roleId: string; readonly action: string; readonly resource: string }>(),
	permissions: new Array<{ readonly id: string; readonly action: string; readonly resource: string }>(),
	assignedRoleIds: new Map<string, string[]>(),
	users: new Map<string, { readonly id: string; readonly isSuperAdmin: boolean }>(),
}));

vi.mock("../kernel/authorization-kernel.service", () => ({
	AuthorizationKernelService: class {
		public readonly can = state.can;
	},
}));

vi.mock("../repositories/role.repository", () => ({
	RoleRepository: class {
		/** Contract: parent links whatever the role's deleted / active state. */
		public readonly findParentLinks = (roleIds: readonly string[]): Promise<{ id: string; parentId: string | null }[]> =>
			Promise.resolve(state.roles.filter((role) => roleIds.includes(role.id)).map((role) => ({ id: role.id, parentId: role.parentId })));
		/** Contract: only live, active roles. */
		public readonly findEffectiveParentLinks = (roleIds: readonly string[]): Promise<{ id: string; parentId: string | null }[]> =>
			Promise.resolve(state.roles.filter((role) => roleIds.includes(role.id) && !role.isDeleted && role.isActive).map((role) => ({ id: role.id, parentId: role.parentId })));
	},
}));

vi.mock("../repositories/permission.repository", () => ({
	PermissionRepository: class {
		public readonly findKeysByIds = (ids: readonly string[]): Promise<{ action: string; resource: string }[]> =>
			Promise.resolve(state.permissions.filter((permission) => ids.includes(permission.id)).map(({ action, resource }) => ({ action, resource })));
	},
}));

vi.mock("../repositories/role-assignment.repository", () => ({
	RoleAssignmentRepository: class {
		public readonly findAssignedRoleIds = (userId: string): Promise<string[]> => Promise.resolve(state.assignedRoleIds.get(userId) ?? []);
		public readonly findRolePermissionKeys = (roleIds: readonly string[]): Promise<{ action: string; resource: string }[]> =>
			Promise.resolve(state.rolePermissions.filter((row) => roleIds.includes(row.roleId)).map(({ action, resource }) => ({ action, resource })));
		public readonly findTargetUser = (userId: string): Promise<{ id: string; isSuperAdmin: boolean } | null> => Promise.resolve(state.users.get(userId) ?? null);
	},
}));

const admin: AuthorizationActor = { id: "admin-1", isSuperAdmin: false };
const superAdmin: AuthorizationActor = { id: "root", isSuperAdmin: true };

/** The acting admin holds ROLE:UPDATE and USER:READ only. */
const HELD = new Set(["UPDATE:ROLE", "READ:USER"]);

function role(id: string, parentId: string | null, flags: Partial<Pick<RoleRow, "isDeleted" | "isActive">> = {}): RoleRow {
	return { id, parentId, isDeleted: flags.isDeleted ?? false, isActive: flags.isActive ?? true };
}

function service(): PrivilegeEscalationService {
	const prisma = createTestPrisma();
	return new PrivilegeEscalationService(createTestAuthorizationKernel(prisma), new RoleRepository(prisma), new PermissionRepository(prisma), new RoleAssignmentRepository());
}

describe("PrivilegeEscalationService", () => {
	const db = createTestPrisma();

	beforeEach(() => {
		vi.clearAllMocks();
		state.can.mockImplementation((request: AuthorizationRequest) => Promise.resolve(HELD.has(`${request.action}:${request.resource}`) ? "ALLOW" : "DENY"));
		state.roles.splice(0, state.roles.length, role("role-manager", null), role("role-regional", "role-manager"), role("role-admin", null));
		state.rolePermissions.splice(0, state.rolePermissions.length);
		state.permissions.splice(0, state.permissions.length);
		state.assignedRoleIds.clear();
		state.assignedRoleIds.set("admin-1", ["role-regional"]);
		state.users.clear();
	});

	it("blocks non-superadmins from changing their own assignments", () => {
		expect(() => {
			service().assertNotSelf(admin, "admin-1");
		}).toThrow(AuthorizationException);
		expect(() => {
			service().assertNotSelf(admin, "user-2");
		}).not.toThrow();
		expect(() => {
			service().assertNotSelf(superAdmin, "root");
		}).not.toThrow();
	});

	it("only lets a SuperAdmin manage a SuperAdmin account, and rejects unknown targets", async () => {
		state.users.set("root-2", { id: "root-2", isSuperAdmin: true });
		state.users.set("user-2", { id: "user-2", isSuperAdmin: false });

		await expect(service().requireManageableUser(admin, "root-2", db)).rejects.toBeInstanceOf(AuthorizationException);
		await expect(service().requireManageableUser(superAdmin, "root-2", db)).resolves.toEqual({ id: "root-2", isSuperAdmin: true });
		await expect(service().requireManageableUser(admin, "user-2", db)).resolves.toEqual({ id: "user-2", isSuperAdmin: false });
		await expect(service().requireManageableUser(admin, "ghost", db)).rejects.toBeInstanceOf(NotFoundError);
		await expect(service().requireManageableUser(admin, "admin-1", db)).rejects.toBeInstanceOf(AuthorizationException);
	});

	it("blocks editing a role the actor holds directly or through inheritance", async () => {
		await expect(service().assertNotHoldingRole(admin, "role-regional", db)).rejects.toBeInstanceOf(AuthorizationException);
		await expect(service().assertNotHoldingRole(admin, "role-manager", db)).rejects.toBeInstanceOf(AuthorizationException);
		await expect(service().assertNotHoldingRole(admin, "role-admin", db)).resolves.toBeUndefined();
	});

	it("only lets actors grant permissions they already hold globally", async () => {
		state.permissions.push({ id: "perm-read-user", action: "READ", resource: "USER" }, { id: "perm-manage-permission", action: "MANAGE", resource: "PERMISSION" });

		await expect(service().assertCanGrantPermissions(admin, ["perm-read-user"], db)).resolves.toBeUndefined();
		await expect(service().assertCanGrantPermissions(admin, ["perm-manage-permission"], db)).rejects.toBeInstanceOf(AuthorizationException);
		expect(state.can).toHaveBeenLastCalledWith({ subject: { userId: "admin-1", isSuperAdmin: false }, action: "MANAGE", resource: "PERMISSION" });
	});

	it("checks raw permission pairs (a deleted permission being restored)", async () => {
		await expect(service().assertHoldsPermissionPairs(admin, [{ action: "READ", resource: "USER" }])).resolves.toBeUndefined();
		await expect(service().assertHoldsPermissionPairs(admin, [{ action: "MANAGE", resource: "SYSTEM_SETTINGS" }])).rejects.toBeInstanceOf(AuthorizationException);
	});

	it("checks every permission a role confers, including inherited ones", async () => {
		state.rolePermissions.push({ roleId: "role-regional", action: "READ", resource: "USER" }, { roleId: "role-manager", action: "MANAGE", resource: "SYSTEM_SETTINGS" });

		await expect(service().assertCanGrantRoles(admin, ["role-regional"], db)).rejects.toBeInstanceOf(AuthorizationException);
	});

	it("restoring a deleted role still walks its ancestors (the restored role re-activates the whole hierarchy)", async () => {
		// role-regional is soft-deleted; its live parent confers a permission the admin lacks.
		state.roles.splice(0, state.roles.length, role("role-manager", null), role("role-regional", "role-manager", { isDeleted: true }));
		state.rolePermissions.push({ roleId: "role-regional", action: "READ", resource: "USER" }, { roleId: "role-manager", action: "MANAGE", resource: "SYSTEM_SETTINGS" });

		await expect(service().assertCanGrantRoles(admin, ["role-regional"], db)).rejects.toBeInstanceOf(AuthorizationException);
	});

	it("walks through deleted and inactive ancestors (a later restore / re-activation brings them back)", async () => {
		state.roles.splice(
			0,
			state.roles.length,
			role("role-root", null),
			role("role-middle", "role-root", { isDeleted: true }),
			role("role-leaf", "role-middle", { isActive: false }),
		);
		state.rolePermissions.push({ roleId: "role-root", action: "MANAGE", resource: "SYSTEM_SETTINGS" });

		await expect(service().assertCanGrantRoles(admin, ["role-leaf"], db)).rejects.toBeInstanceOf(AuthorizationException);
	});

	it("exempts platform SuperAdmins", async () => {
		await expect(service().assertCanGrantPermissions(superAdmin, ["anything"], db)).resolves.toBeUndefined();
		await expect(service().assertCanGrantRoles(superAdmin, ["role-admin"], db)).resolves.toBeUndefined();
		await expect(service().assertNotHoldingRole(superAdmin, "role-regional", db)).resolves.toBeUndefined();
		expect(state.can).not.toHaveBeenCalled();
	});
});
