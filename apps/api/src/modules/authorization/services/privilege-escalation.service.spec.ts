import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthorizationRequest } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";
import { AuthorizationException } from "../exceptions/authorization.exception";
import { AuthorizationKernelService } from "../kernel/authorization-kernel.service";
import { PrivilegeEscalationService, type AuthorizationActor } from "./privilege-escalation.service";

const mocks = vi.hoisted(() => ({
	can: vi.fn(),
	permissionFindMany: vi.fn(),
	rolePermissionFindMany: vi.fn(),
	userRoleFindMany: vi.fn(),
	roleFindMany: vi.fn(),
}));

vi.mock("../kernel/authorization-kernel.service", () => ({
	AuthorizationKernelService: class {
		public readonly can = mocks.can;
	},
}));

vi.mock("../../../prisma/prisma.service", () => ({
	PrismaService: class {
		public readonly permission = { findMany: mocks.permissionFindMany };
		public readonly rolePermission = { findMany: mocks.rolePermissionFindMany };
		public readonly userRole = { findMany: mocks.userRoleFindMany };
		public readonly role = { findMany: mocks.roleFindMany };
	},
}));

const admin: AuthorizationActor = { id: "admin-1", isSuperAdmin: false };
const superAdmin: AuthorizationActor = { id: "root", isSuperAdmin: true };

/** The acting admin holds ROLE:UPDATE and USER:READ only. */
const HELD = new Set(["UPDATE:ROLE", "READ:USER"]);

const roleParents: Readonly<Record<string, string | null>> = { "role-manager": null, "role-regional": "role-manager", "role-admin": null };

function service(): PrivilegeEscalationService {
	return new PrivilegeEscalationService(new PrismaService(), new AuthorizationKernelService());
}

describe("PrivilegeEscalationService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.can.mockImplementation(async (request: AuthorizationRequest) => (HELD.has(`${request.action}:${request.resource}`) ? "ALLOW" : "DENY"));
		mocks.roleFindMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.map((id) => ({ parentId: roleParents[id] ?? null })));
		mocks.userRoleFindMany.mockResolvedValue([{ roleId: "role-regional" }]);
	});

	it("blocks non-superadmins from changing their own assignments", () => {
		expect(() => service().assertNotSelf(admin, "admin-1")).toThrow(AuthorizationException);
		expect(() => service().assertNotSelf(admin, "user-2")).not.toThrow();
		expect(() => service().assertNotSelf(superAdmin, "root")).not.toThrow();
	});

	it("blocks editing a role the actor holds directly or through inheritance", async () => {
		await expect(service().assertNotHoldingRole(admin, "role-regional")).rejects.toBeInstanceOf(AuthorizationException);
		await expect(service().assertNotHoldingRole(admin, "role-manager")).rejects.toBeInstanceOf(AuthorizationException);
		await expect(service().assertNotHoldingRole(admin, "role-admin")).resolves.toBeUndefined();
	});

	it("only lets actors grant permissions they already hold globally", async () => {
		mocks.permissionFindMany.mockResolvedValue([{ action: "READ", resource: "USER" }]);
		await expect(service().assertCanGrantPermissions(admin, ["perm-read-user"])).resolves.toBeUndefined();

		mocks.permissionFindMany.mockResolvedValue([{ action: "MANAGE", resource: "PERMISSION" }]);
		await expect(service().assertCanGrantPermissions(admin, ["perm-manage-permission"])).rejects.toBeInstanceOf(AuthorizationException);

		expect(mocks.can).toHaveBeenLastCalledWith({ subject: { userId: "admin-1", isSuperAdmin: false }, action: "MANAGE", resource: "PERMISSION" });
	});

	it("checks every permission a role confers, including inherited ones", async () => {
		mocks.rolePermissionFindMany.mockResolvedValue([{ permission: { action: "READ", resource: "USER" } }, { permission: { action: "MANAGE", resource: "SYSTEM_SETTINGS" } }]);

		await expect(service().assertCanGrantRoles(admin, ["role-regional"])).rejects.toBeInstanceOf(AuthorizationException);
		expect(mocks.rolePermissionFindMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: expect.objectContaining({ roleId: { in: ["role-regional", "role-manager"] } }) }),
		);
	});

	it("exempts platform SuperAdmins", async () => {
		await expect(service().assertCanGrantPermissions(superAdmin, ["anything"])).resolves.toBeUndefined();
		await expect(service().assertCanGrantRoles(superAdmin, ["role-admin"])).resolves.toBeUndefined();
		await expect(service().assertNotHoldingRole(superAdmin, "role-regional")).resolves.toBeUndefined();
		expect(mocks.can).not.toHaveBeenCalled();
	});
});
