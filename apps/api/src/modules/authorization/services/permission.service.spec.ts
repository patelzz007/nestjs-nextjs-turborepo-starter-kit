import type { AclEffect, Permission, UserPermission } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RequestContextService } from "../../../common/context/request-context";
import { AuthorizationError, ConflictError, NotFoundError } from "../../../common/errors/app-error";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { AuthorizationAuditService } from "../audit/authorization-audit.service";
import { AuthorizationEventEmitter } from "../events/authorization.events";
import { AuthorizationException } from "../exceptions/authorization.exception";
import { PermissionRepository } from "../repositories/permission.repository";
import { RoleAssignmentRepository } from "../repositories/role-assignment.repository";
import { RoleRepository } from "../repositories/role.repository";
import { ConflictDetectionService } from "./conflict-detection.service";
import { PermissionService } from "./permission.service";
import { PrivilegeEscalationService, type AuthorizationActor } from "./privilege-escalation.service";
import { RbacMutationRunner, type RbacMutationOutcome } from "./rbac-mutation.runner";
import { createTestSessionRevocation } from "./__tests__/rbac-test-graph";
import { createTestAuthorizationKernel, createTestPrisma } from "../../../../test/support/test-service-graph";

const mocks = vi.hoisted(() => ({
	outcomes: new Array<{ readonly kind: string; readonly audit?: object; readonly affectedUserIds?: readonly string[] }>(),
	permissions: {
		findById: vi.fn(),
		findDeletedById: vi.fn(),
		findAnyByActionResource: vi.fn(),
		countExisting: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		softDelete: vi.fn(),
		restore: vi.fn(),
	},
	assignments: {
		findAffectedUserIdsByPermission: vi.fn(),
		findDirectOverrides: vi.fn(),
		givePermissionToUser: vi.fn(),
		revokePermissionFromUser: vi.fn(),
		syncUserAllowGrants: vi.fn(),
	},
	escalation: {
		requireManageableUser: vi.fn(),
		assertCanGrantPermissions: vi.fn(),
		assertHoldsPermissionPairs: vi.fn(),
	},
	conflicts: { assertNoAllowDenyConflict: vi.fn() },
}));

vi.mock("../repositories/permission.repository", () => ({
	PermissionRepository: class {
		public readonly findById = mocks.permissions.findById;
		public readonly findDeletedById = mocks.permissions.findDeletedById;
		public readonly findAnyByActionResource = mocks.permissions.findAnyByActionResource;
		public readonly countExisting = mocks.permissions.countExisting;
		public readonly create = mocks.permissions.create;
		public readonly update = mocks.permissions.update;
		public readonly softDelete = mocks.permissions.softDelete;
		public readonly restore = mocks.permissions.restore;
	},
}));
vi.mock("../repositories/role-assignment.repository", () => ({
	RoleAssignmentRepository: class {
		public readonly findAffectedUserIdsByPermission = mocks.assignments.findAffectedUserIdsByPermission;
		public readonly findDirectOverrides = mocks.assignments.findDirectOverrides;
		public readonly givePermissionToUser = mocks.assignments.givePermissionToUser;
		public readonly revokePermissionFromUser = mocks.assignments.revokePermissionFromUser;
		public readonly syncUserAllowGrants = mocks.assignments.syncUserAllowGrants;
	},
}));
vi.mock("./privilege-escalation.service", () => ({
	PrivilegeEscalationService: class {
		public readonly requireManageableUser = mocks.escalation.requireManageableUser;
		public readonly assertCanGrantPermissions = mocks.escalation.assertCanGrantPermissions;
		public readonly assertHoldsPermissionPairs = mocks.escalation.assertHoldsPermissionPairs;
	},
}));
vi.mock("./conflict-detection.service", () => ({
	ConflictDetectionService: class {
		public readonly assertNoAllowDenyConflict = mocks.conflicts.assertNoAllowDenyConflict;
	},
}));
vi.mock("./rbac-mutation.runner", () => ({
	RbacMutationRunner: class {
		public async run<T>(_actor: AuthorizationActor, _reason: string, work: (tx: object) => Promise<RbacMutationOutcome<T>>): Promise<T> {
			const outcome = await work({});
			mocks.outcomes.push(outcome);
			return outcome.result;
		}
	},
}));

const admin: AuthorizationActor = { id: "admin-1", isSuperAdmin: false };
const EPOCH = BigInt(1_790_812_800_000);
const OVERRIDE_EFFECTS: [AclEffect, AclEffect] = ["ALLOW", "DENY"];

function buildPermission(overrides: Partial<Permission> = {}): Permission {
	return {
		id: "perm-1",
		action: "MANAGE",
		resource: "SYSTEM_SETTINGS",
		description: null,
		scope: "GLOBAL",
		group: null,
		isSystem: false,
		conditions: null,
		isDeleted: false,
		deletedAt: null,
		createdAt: EPOCH,
		updatedAt: EPOCH,
		...overrides,
	};
}

function buildGrant(overrides: Partial<UserPermission> = {}): UserPermission {
	return {
		id: "up-1",
		userId: "user-2",
		permissionId: "perm-1",
		effect: "ALLOW",
		assignedAt: EPOCH,
		assignedBy: "admin-1",
		expiresAt: null,
		isDeleted: false,
		deletedAt: null,
		createdAt: EPOCH,
		updatedAt: EPOCH,
		...overrides,
	};
}

function service(): PermissionService {
	const prisma = createTestPrisma();
	const requestContext = new RequestContextService();
	return new PermissionService(
		new PermissionRepository(prisma),
		new RoleAssignmentRepository(),
		new PrivilegeEscalationService(createTestAuthorizationKernel(prisma), new RoleRepository(prisma), new PermissionRepository(prisma), new RoleAssignmentRepository()),
		new ConflictDetectionService(new RoleRepository(prisma), new RoleAssignmentRepository(), new TenantTransactionService(prisma, requestContext)),
		new RbacMutationRunner(
			new TenantTransactionService(prisma, requestContext),
			new AuthorizationAuditService(requestContext),
			createTestSessionRevocation(prisma),
			new AuthorizationEventEmitter(),
		),
	);
}

describe("PermissionService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.outcomes.length = 0;
		mocks.permissions.findById.mockResolvedValue(buildPermission());
		mocks.permissions.countExisting.mockImplementation((ids: readonly string[]) => Promise.resolve(ids.length));
		mocks.assignments.findAffectedUserIdsByPermission.mockResolvedValue(["holder-1", "holder-2"]);
		mocks.assignments.findDirectOverrides.mockResolvedValue([]);
		mocks.assignments.givePermissionToUser.mockResolvedValue(buildGrant());
		mocks.assignments.revokePermissionFromUser.mockResolvedValue(true);
		mocks.escalation.requireManageableUser.mockResolvedValue({ id: "user-2", isSuperAdmin: false });
		mocks.escalation.assertCanGrantPermissions.mockResolvedValue(undefined);
		mocks.escalation.assertHoldsPermissionPairs.mockResolvedValue(undefined);
		mocks.conflicts.assertNoAllowDenyConflict.mockResolvedValue(undefined);
	});

	describe("restore", () => {
		it("requires the actor to hold the restored permission, audits it, and re-authenticates every holder", async () => {
			mocks.permissions.findDeletedById.mockResolvedValue(buildPermission({ isDeleted: true }));
			mocks.permissions.restore.mockResolvedValue(buildPermission());

			await service().restore(admin, "perm-1");

			expect(mocks.escalation.assertHoldsPermissionPairs).toHaveBeenCalledWith(admin, [expect.objectContaining({ action: "MANAGE", resource: "SYSTEM_SETTINGS" })]);
			expect(mocks.outcomes.at(-1)).toMatchObject({
				kind: "changed",
				audit: { action: "PERMISSION_RESTORED", permissionId: "perm-1" },
				affectedUserIds: ["holder-1", "holder-2"],
			});
		});

		it("refuses a restore that would hand holders a permission the actor lacks", async () => {
			mocks.permissions.findDeletedById.mockResolvedValue(buildPermission({ isDeleted: true }));
			mocks.escalation.assertHoldsPermissionPairs.mockRejectedValue(new AuthorizationException());

			await expect(service().restore(admin, "perm-1")).rejects.toBeInstanceOf(AuthorizationException);
			expect(mocks.permissions.restore).not.toHaveBeenCalled();
		});

		it("reports a permission that is not deleted as not found", async () => {
			mocks.permissions.findDeletedById.mockResolvedValue(null);

			await expect(service().restore(admin, "perm-1")).rejects.toBeInstanceOf(NotFoundError);
		});
	});

	describe("system permissions are server-controlled", () => {
		beforeEach(() => {
			mocks.permissions.findById.mockResolvedValue(buildPermission({ isSystem: true }));
		});

		it("rejects metadata edits", async () => {
			await expect(service().update(admin, "perm-1", { description: "x" })).rejects.toBeInstanceOf(AuthorizationError);
			expect(mocks.permissions.update).not.toHaveBeenCalled();
		});

		it("rejects deletion", async () => {
			await expect(service().remove(admin, "perm-1")).rejects.toBeInstanceOf(AuthorizationError);
			expect(mocks.permissions.softDelete).not.toHaveBeenCalled();
		});
	});

	it("deleting a permission requires holding it and re-authenticates its holders", async () => {
		await service().remove(admin, "perm-1");

		expect(mocks.escalation.assertHoldsPermissionPairs).toHaveBeenCalledWith(admin, [expect.objectContaining({ id: "perm-1" })]);
		expect(mocks.outcomes.at(-1)).toMatchObject({ audit: { action: "PERMISSION_DELETED", permissionId: "perm-1" }, affectedUserIds: ["holder-1", "holder-2"] });
	});

	it("metadata edits are audited but revoke nobody's session", async () => {
		mocks.permissions.update.mockResolvedValue(buildPermission({ description: "x" }));

		await service().update(admin, "perm-1", { description: "x" });

		expect(mocks.outcomes.at(-1)).toMatchObject({ audit: { action: "PERMISSION_UPDATED", permissionId: "perm-1" }, affectedUserIds: [] });
	});

	it("rejects creating a permission whose pair already exists (even soft-deleted)", async () => {
		mocks.permissions.findAnyByActionResource.mockResolvedValue(buildPermission({ isDeleted: true }));

		await expect(service().create(admin, { action: "MANAGE", resource: "SYSTEM_SETTINGS" })).rejects.toBeInstanceOf(ConflictError);
		expect(mocks.permissions.create).not.toHaveBeenCalled();
	});

	describe("direct grants", () => {
		it.each(OVERRIDE_EFFECTS)("subjects a %s override to the subset rule", async (effect) => {
			mocks.escalation.assertCanGrantPermissions.mockRejectedValue(new AuthorizationException());

			await expect(service().giveToUser(admin, { userId: "user-2", permissionId: "perm-1", effect, expiresAt: undefined })).rejects.toBeInstanceOf(AuthorizationException);
			expect(mocks.assignments.givePermissionToUser).not.toHaveBeenCalled();
		});

		it("records the grant with the actor and revokes the target's sessions", async () => {
			await service().giveToUser(admin, { userId: "user-2", permissionId: "perm-1", effect: "DENY", expiresAt: 1_800_000_000_000 });

			expect(mocks.assignments.givePermissionToUser).toHaveBeenCalledWith(
				{ userId: "user-2", permissionId: "perm-1", effect: "DENY", expiresAt: 1_800_000_000_000, assignedBy: "admin-1" },
				expect.anything(),
			);
			expect(mocks.outcomes.at(-1)).toMatchObject({ audit: { action: "PERMISSION_GRANTED", targetUserId: "user-2", permissionId: "perm-1" }, affectedUserIds: ["user-2"] });
		});

		it("revoking (which may lift a DENY) is subset-checked", async () => {
			mocks.escalation.assertCanGrantPermissions.mockRejectedValue(new AuthorizationException());

			await expect(service().revokeFromUser(admin, "user-2", "perm-1")).rejects.toBeInstanceOf(AuthorizationException);
			expect(mocks.assignments.revokePermissionFromUser).not.toHaveBeenCalled();
		});
	});

	describe("sync", () => {
		it("rejects listing a permission the user holds a DENY override for (no silent DENY → ALLOW)", async () => {
			mocks.conflicts.assertNoAllowDenyConflict.mockRejectedValue(new ConflictError({ message: "deny" }));

			await expect(service().syncUserPermissions(admin, "user-2", ["perm-denied"])).rejects.toBeInstanceOf(ConflictError);
			expect(mocks.assignments.syncUserAllowGrants).not.toHaveBeenCalled();
		});

		it("subset-checks both the new grants and the ALLOW grants it removes; DENY overrides are left alone", async () => {
			mocks.assignments.findDirectOverrides.mockResolvedValue([
				{ permissionId: "perm-old", effect: "ALLOW" },
				{ permissionId: "perm-denied", effect: "DENY" },
				{ permissionId: "perm-keep", effect: "ALLOW" },
			]);

			await service().syncUserPermissions(admin, "user-2", ["perm-keep", "perm-new"]);

			expect(mocks.escalation.assertCanGrantPermissions).toHaveBeenCalledWith(admin, ["perm-keep", "perm-new", "perm-old"], expect.anything());
			expect(mocks.assignments.syncUserAllowGrants).toHaveBeenCalledWith("user-2", ["perm-keep", "perm-new"], "admin-1", expect.anything());
			expect(mocks.outcomes.at(-1)).toMatchObject({ audit: { action: "USER_PERMISSIONS_SYNCED", targetUserId: "user-2" }, affectedUserIds: ["user-2"] });
		});

		it("rejects unknown permissions", async () => {
			mocks.permissions.countExisting.mockResolvedValue(0);

			await expect(service().syncUserPermissions(admin, "user-2", ["perm-missing"])).rejects.toBeInstanceOf(NotFoundError);
		});
	});
});
