import type { Role, UserRole } from "@prisma/client";
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
import { PrivilegeEscalationService, type AuthorizationActor } from "./privilege-escalation.service";
import { RbacMutationRunner, type RbacMutationOutcome } from "./rbac-mutation.runner";
import { RoleService } from "./role.service";
import { createTestAuthorizationKernel, createTestPrisma } from "../../../../test/support/test-service-graph";
import { createTestSessionRevocation } from "./__tests__/rbac-test-graph";

const mocks = vi.hoisted(() => ({
	outcomes: new Array<{ readonly kind: string; readonly audit?: object; readonly affectedUserIds?: readonly string[] }>(),
	roles: {
		findById: vi.fn(),
		findByIdIncludingDeleted: vi.fn(),
		findByName: vi.fn(),
		findByNameIncludingDeleted: vi.fn(),
		findChildIds: vi.fn(),
		findParentLinks: vi.fn(),
		findSystemRolesByName: vi.fn(),
		create: vi.fn(),
		update: vi.fn(),
		softDelete: vi.fn(),
		restore: vi.fn(),
		setParent: vi.fn(),
	},
	permissions: { countExisting: vi.fn() },
	assignments: {
		findActiveHolderIds: vi.fn(),
		findAssignedRoleIds: vi.fn(),
		isRoleAssigned: vi.fn(),
		countActiveHolders: vi.fn(),
		syncRolePermissions: vi.fn(),
		assignRoleToUser: vi.fn(),
		removeRoleFromUser: vi.fn(),
		syncUserRoles: vi.fn(),
	},
	escalation: {
		requireManageableUser: vi.fn(),
		assertNotHoldingRole: vi.fn(),
		assertCanGrantRoles: vi.fn(),
		assertCanGrantPermissions: vi.fn(),
	},
	conflicts: { assertUsersHaveNoConflicts: vi.fn() },
	auditRecord: vi.fn(),
}));

vi.mock("../repositories/role.repository", () => ({
	RoleRepository: class {
		public readonly findById = mocks.roles.findById;
		public readonly findByIdIncludingDeleted = mocks.roles.findByIdIncludingDeleted;
		public readonly findByName = mocks.roles.findByName;
		public readonly findByNameIncludingDeleted = mocks.roles.findByNameIncludingDeleted;
		public readonly findChildIds = mocks.roles.findChildIds;
		public readonly findParentLinks = mocks.roles.findParentLinks;
		public readonly findSystemRolesByName = mocks.roles.findSystemRolesByName;
		public readonly create = mocks.roles.create;
		public readonly update = mocks.roles.update;
		public readonly softDelete = mocks.roles.softDelete;
		public readonly restore = mocks.roles.restore;
		public readonly setParent = mocks.roles.setParent;
	},
}));
vi.mock("../repositories/permission.repository", () => ({
	PermissionRepository: class {
		public readonly countExisting = mocks.permissions.countExisting;
	},
}));
vi.mock("../repositories/role-assignment.repository", () => ({
	RoleAssignmentRepository: class {
		public readonly findActiveHolderIds = mocks.assignments.findActiveHolderIds;
		public readonly findAssignedRoleIds = mocks.assignments.findAssignedRoleIds;
		public readonly isRoleAssigned = mocks.assignments.isRoleAssigned;
		public readonly countActiveHolders = mocks.assignments.countActiveHolders;
		public readonly syncRolePermissions = mocks.assignments.syncRolePermissions;
		public readonly assignRoleToUser = mocks.assignments.assignRoleToUser;
		public readonly removeRoleFromUser = mocks.assignments.removeRoleFromUser;
		public readonly syncUserRoles = mocks.assignments.syncUserRoles;
	},
}));
vi.mock("./privilege-escalation.service", () => ({
	PrivilegeEscalationService: class {
		public readonly requireManageableUser = mocks.escalation.requireManageableUser;
		public readonly assertNotHoldingRole = mocks.escalation.assertNotHoldingRole;
		public readonly assertCanGrantRoles = mocks.escalation.assertCanGrantRoles;
		public readonly assertCanGrantPermissions = mocks.escalation.assertCanGrantPermissions;
	},
}));
vi.mock("./conflict-detection.service", () => ({
	ConflictDetectionService: class {
		public readonly assertUsersHaveNoConflicts = mocks.conflicts.assertUsersHaveNoConflicts;
	},
}));
vi.mock("../audit/authorization-audit.service", () => ({
	AuthorizationAuditService: class {
		public readonly record = mocks.auditRecord;
	},
}));
/** The runner runs the work on a sentinel client and records what it produced (atomicity is covered by its own spec). */
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

function buildRole(overrides: Partial<Role> = {}): Role {
	return {
		id: "role-1",
		name: "Editor",
		description: null,
		isActive: true,
		isSystem: false,
		parentId: null,
		isDeleted: false,
		deletedAt: null,
		createdAt: EPOCH,
		updatedAt: EPOCH,
		...overrides,
	};
}

function buildUserRole(userId: string, roleId: string): UserRole {
	return { id: "ur-1", userId, roleId, assignedAt: EPOCH, assignedBy: "admin-1", isDeleted: false, deletedAt: null, createdAt: EPOCH, updatedAt: EPOCH };
}

function service(): RoleService {
	const prisma = createTestPrisma();
	const requestContext = new RequestContextService();
	const audit = new AuthorizationAuditService(requestContext);
	return new RoleService(
		new RoleRepository(prisma),
		new RoleAssignmentRepository(),
		new PermissionRepository(prisma),
		new PrivilegeEscalationService(createTestAuthorizationKernel(prisma), new RoleRepository(prisma), new PermissionRepository(prisma), new RoleAssignmentRepository()),
		new ConflictDetectionService(new RoleRepository(prisma), new RoleAssignmentRepository(), new TenantTransactionService(prisma, requestContext)),
		new RbacMutationRunner(new TenantTransactionService(prisma, requestContext), audit, createTestSessionRevocation(prisma), new AuthorizationEventEmitter()),
		audit,
	);
}

const db = createTestPrisma();

/** Await a call for its rejection only. */
async function discard(pending: Promise<Role> | Promise<void>): Promise<void> {
	await pending;
}

describe("RoleService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.outcomes.length = 0;
		mocks.roles.findById.mockResolvedValue(buildRole());
		mocks.roles.findByNameIncludingDeleted.mockResolvedValue(null);
		mocks.roles.findChildIds.mockResolvedValue([]);
		mocks.roles.findParentLinks.mockResolvedValue([]);
		mocks.roles.findSystemRolesByName.mockResolvedValue([]);
		mocks.assignments.findActiveHolderIds.mockResolvedValue(["holder-1"]);
		mocks.assignments.findAssignedRoleIds.mockResolvedValue([]);
		mocks.assignments.removeRoleFromUser.mockResolvedValue(true);
		mocks.assignments.assignRoleToUser.mockImplementation((userId: string, roleId: string) => Promise.resolve(buildUserRole(userId, roleId)));
		mocks.escalation.requireManageableUser.mockResolvedValue({ id: "user-2", isSuperAdmin: false });
		mocks.escalation.assertNotHoldingRole.mockResolvedValue(undefined);
		mocks.escalation.assertCanGrantRoles.mockResolvedValue(undefined);
		mocks.escalation.assertCanGrantPermissions.mockResolvedValue(undefined);
		mocks.conflicts.assertUsersHaveNoConflicts.mockResolvedValue(undefined);
		mocks.permissions.countExisting.mockImplementation((ids: readonly string[]) => Promise.resolve(ids.length));
	});

	describe("system roles are server-controlled", () => {
		beforeEach(() => {
			mocks.roles.findById.mockResolvedValue(buildRole({ name: "Admin", isSystem: true }));
		});

		it.each([
			["update", (target: RoleService): Promise<void> => discard(target.update(admin, "role-1", { name: "Renamed" }))],
			["remove", (target: RoleService): Promise<void> => discard(target.remove(admin, "role-1"))],
			["setParent", (target: RoleService): Promise<void> => discard(target.setParent(admin, "role-1", null))],
			["syncPermissions", (target: RoleService): Promise<void> => discard(target.syncPermissions(admin, "role-1", []))],
		])("rejects %s on a system role without writing", async (_name, call) => {
			await expect(call(service())).rejects.toBeInstanceOf(AuthorizationError);

			expect(mocks.roles.update).not.toHaveBeenCalled();
			expect(mocks.roles.softDelete).not.toHaveBeenCalled();
			expect(mocks.roles.setParent).not.toHaveBeenCalled();
			expect(mocks.assignments.syncRolePermissions).not.toHaveBeenCalled();
		});
	});

	it("creates roles as non-system and rejects a name that collides with a soft-deleted role", async () => {
		mocks.roles.findByNameIncludingDeleted.mockResolvedValue(buildRole({ isDeleted: true }));

		await expect(service().create(admin, { name: "Editor" })).rejects.toBeInstanceOf(ConflictError);
		expect(mocks.roles.create).not.toHaveBeenCalled();
	});

	it("checks the parent's lineage before creating a child role", async () => {
		mocks.roles.create.mockResolvedValue(buildRole({ id: "role-new", parentId: "role-parent" }));

		await service().create(admin, { name: "Child", parentId: "role-parent" });

		expect(mocks.escalation.assertCanGrantRoles).toHaveBeenCalledWith(admin, ["role-parent"], expect.anything());
		expect(mocks.outcomes.at(-1)).toMatchObject({ kind: "changed", audit: { action: "ROLE_CREATED", targetRoleId: "role-new" }, affectedUserIds: [] });
	});

	it("deleting a role requires holding none of it and reaching all of it, and re-authenticates holders of the role and its descendants", async () => {
		mocks.roles.findChildIds.mockResolvedValueOnce(["role-child"]).mockResolvedValue([]);

		await service().remove(admin, "role-1");

		expect(mocks.escalation.assertNotHoldingRole).toHaveBeenCalledWith(admin, "role-1", expect.anything());
		expect(mocks.escalation.assertCanGrantRoles).toHaveBeenCalledWith(admin, ["role-1"], expect.anything());
		expect(mocks.assignments.findActiveHolderIds).toHaveBeenCalledWith(["role-1", "role-child"], expect.anything());
		expect(mocks.outcomes.at(-1)).toMatchObject({ audit: { action: "ROLE_DELETED", targetRoleId: "role-1" }, affectedUserIds: ["holder-1"] });
	});

	it("restoring a role is escalation-checked, audited with the actor, and revokes the holders' sessions", async () => {
		mocks.roles.findByIdIncludingDeleted.mockResolvedValue(buildRole({ isDeleted: true }));
		mocks.roles.restore.mockResolvedValue(buildRole());

		await service().restore(admin, "role-1");

		expect(mocks.escalation.assertNotHoldingRole).toHaveBeenCalledWith(admin, "role-1", expect.anything());
		expect(mocks.escalation.assertCanGrantRoles).toHaveBeenCalledWith(admin, ["role-1"], expect.anything());
		expect(mocks.conflicts.assertUsersHaveNoConflicts).toHaveBeenCalledWith(["holder-1"], expect.anything());
		expect(mocks.outcomes.at(-1)).toMatchObject({ kind: "changed", audit: { action: "ROLE_RESTORED", targetRoleId: "role-1" }, affectedUserIds: ["holder-1"] });
	});

	it("refuses to restore when the actor cannot reach the restored lineage", async () => {
		mocks.roles.findByIdIncludingDeleted.mockResolvedValue(buildRole({ isDeleted: true }));
		mocks.escalation.assertCanGrantRoles.mockRejectedValue(new AuthorizationException());

		await expect(service().restore(admin, "role-1")).rejects.toBeInstanceOf(AuthorizationException);
		expect(mocks.roles.restore).not.toHaveBeenCalled();
	});

	it("rejects a parent that would create a cycle, walking through deleted ancestors", async () => {
		mocks.roles.findById.mockImplementation((id: string) => Promise.resolve(buildRole({ id, name: id })));
		mocks.roles.findParentLinks.mockImplementation((ids: readonly string[]) =>
			Promise.resolve(ids.includes("role-parent") ? [{ id: "role-parent", parentId: "role-deleted-grandparent" }] : [{ id: "role-deleted-grandparent", parentId: "role-1" }]),
		);

		await expect(service().setParent(admin, "role-1", "role-parent")).rejects.toBeInstanceOf(ConflictError);
		expect(mocks.roles.setParent).not.toHaveBeenCalled();
	});

	it("syncing a role's permissions checks the current lineage (removals) and the new set (additions)", async () => {
		await service().syncPermissions(admin, "role-1", ["perm-a", "perm-a", "perm-b"]);

		expect(mocks.escalation.assertCanGrantRoles).toHaveBeenCalledWith(admin, ["role-1"], expect.anything());
		expect(mocks.escalation.assertCanGrantPermissions).toHaveBeenCalledWith(admin, ["perm-a", "perm-b"], expect.anything());
		expect(mocks.assignments.syncRolePermissions).toHaveBeenCalledWith("role-1", ["perm-a", "perm-b"], "admin-1", expect.anything());
	});

	it("rejects a role permission sync naming unknown permissions", async () => {
		mocks.permissions.countExisting.mockResolvedValue(1);

		await expect(service().syncPermissions(admin, "role-1", ["perm-a", "perm-missing"])).rejects.toBeInstanceOf(NotFoundError);
		expect(mocks.assignments.syncRolePermissions).not.toHaveBeenCalled();
	});

	describe("user → role", () => {
		it("assigns with the actor recorded and checks separation of duties after the write", async () => {
			await service().assignToUser(admin, "user-2", "role-1");

			expect(mocks.escalation.requireManageableUser).toHaveBeenCalledWith(admin, "user-2", expect.anything());
			expect(mocks.assignments.assignRoleToUser).toHaveBeenCalledWith("user-2", "role-1", "admin-1", expect.anything());
			expect(mocks.conflicts.assertUsersHaveNoConflicts).toHaveBeenCalledWith(["user-2"], expect.anything());
			expect(mocks.outcomes.at(-1)).toMatchObject({ audit: { action: "ROLE_ASSIGNED", targetUserId: "user-2", targetRoleId: "role-1" }, affectedUserIds: ["user-2"] });
		});

		it("rejects an assignment over the per-user role limit", async () => {
			mocks.assignments.findAssignedRoleIds.mockResolvedValue(Array.from({ length: 10 }, (_value, index) => `role-${String(index + 10)}`));

			await expect(service().assignToUser(admin, "user-2", "role-1")).rejects.toBeInstanceOf(ConflictError);
			expect(mocks.assignments.assignRoleToUser).not.toHaveBeenCalled();
		});

		it("a lesser admin cannot remove a role beyond its own reach", async () => {
			mocks.escalation.assertCanGrantRoles.mockRejectedValue(new AuthorizationException());

			await expect(service().removeFromUser(admin, "user-2", "role-superadmin")).rejects.toBeInstanceOf(AuthorizationException);
			expect(mocks.assignments.removeRoleFromUser).not.toHaveBeenCalled();
		});

		it("never removes the last active holder of a protected system role", async () => {
			mocks.roles.findSystemRolesByName.mockResolvedValue([buildRole({ id: "role-admin", name: "Admin", isSystem: true })]);
			mocks.assignments.countActiveHolders.mockResolvedValue(0);

			await expect(service().removeFromUser(admin, "user-2", "role-admin")).rejects.toBeInstanceOf(ConflictError);
			expect(mocks.outcomes).toEqual([]);
		});

		it("allows removing a protected role while another active holder remains", async () => {
			mocks.roles.findSystemRolesByName.mockResolvedValue([buildRole({ id: "role-admin", name: "Admin", isSystem: true })]);
			mocks.assignments.countActiveHolders.mockResolvedValue(1);

			await service().removeFromUser(admin, "user-2", "role-admin");

			expect(mocks.outcomes.at(-1)).toMatchObject({ audit: { action: "ROLE_REMOVED", targetUserId: "user-2", targetRoleId: "role-admin" }, affectedUserIds: ["user-2"] });
		});

		it("reports removing an unassigned role as not found", async () => {
			mocks.assignments.removeRoleFromUser.mockResolvedValue(false);

			await expect(service().removeFromUser(admin, "user-2", "role-1")).rejects.toBeInstanceOf(NotFoundError);
		});

		it("a role sync escalation-checks both added and removed roles, then enforces SoD and the last protected holder", async () => {
			mocks.assignments.findAssignedRoleIds.mockResolvedValue(["role-old", "role-keep"]);
			mocks.roles.findSystemRolesByName.mockResolvedValue([buildRole({ id: "role-old", name: "SuperAdmin", isSystem: true })]);
			mocks.assignments.countActiveHolders.mockResolvedValue(0);

			await expect(service().syncUserRoles(admin, "user-2", ["role-keep", "role-new"])).rejects.toBeInstanceOf(ConflictError);

			expect(mocks.escalation.assertCanGrantRoles).toHaveBeenCalledWith(admin, ["role-new", "role-old"], expect.anything());
			expect(mocks.conflicts.assertUsersHaveNoConflicts).toHaveBeenCalledWith(["user-2"], expect.anything());
		});

		it("rejects a role sync naming a missing role before writing", async () => {
			mocks.roles.findById.mockResolvedValue(null);

			await expect(service().syncUserRoles(admin, "user-2", ["role-gone"])).rejects.toBeInstanceOf(NotFoundError);
			expect(mocks.assignments.syncUserRoles).not.toHaveBeenCalled();
		});
	});

	describe("provisioning", () => {
		it("attaches the default consumer role with the account as its own actor, idempotently", async () => {
			mocks.roles.findByName.mockResolvedValue(buildRole({ id: "role-user", name: "User", isSystem: true }));
			mocks.assignments.isRoleAssigned.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

			await service().assignDefaultConsumerRole("new-user");
			await service().assignDefaultConsumerRole("new-user");

			expect(mocks.assignments.assignRoleToUser).toHaveBeenCalledTimes(1);
			expect(mocks.assignments.assignRoleToUser).toHaveBeenCalledWith("new-user", "role-user", "new-user", expect.anything());
			expect(mocks.outcomes).toEqual([
				expect.objectContaining({
					kind: "changed",
					audit: { action: "ROLE_ASSIGNED_AT_PROVISIONING", targetUserId: "new-user", targetRoleId: "role-user" },
					affectedUserIds: ["new-user"],
				}),
				expect.objectContaining({ kind: "unchanged" }),
			]);
		});

		it("fails loudly when the default consumer role is not configured", async () => {
			mocks.roles.findByName.mockResolvedValue(null);

			await expect(service().assignDefaultConsumerRole("new-user")).rejects.toBeInstanceOf(NotFoundError);
		});

		it("assignToUserAtProvisioningInTx writes the assignment and its audit row on the caller's transaction, without revocation", async () => {
			const assignment = await service().assignToUserAtProvisioningInTx("new-user", "role-1", "inviter-1", db);

			expect(assignment).toEqual(buildUserRole("new-user", "role-1"));
			expect(mocks.roles.findById).toHaveBeenCalledWith("role-1", db);
			expect(mocks.assignments.assignRoleToUser).toHaveBeenCalledWith("new-user", "role-1", "inviter-1", db);
			expect(mocks.conflicts.assertUsersHaveNoConflicts).toHaveBeenCalledWith(["new-user"], db);
			expect(mocks.auditRecord).toHaveBeenCalledWith(
				{ action: "ROLE_ASSIGNED_AT_PROVISIONING", actor: { kind: "USER", userId: "inviter-1" }, targetUserId: "new-user", targetRoleId: "role-1" },
				db,
			);
			expect(mocks.outcomes).toEqual([]);
		});

		it("assignToUserAtProvisioningInTx rejects an unknown role and propagates an audit failure", async () => {
			mocks.roles.findById.mockResolvedValueOnce(null);
			await expect(service().assignToUserAtProvisioningInTx("new-user", "role-gone", "inviter-1", db)).rejects.toBeInstanceOf(NotFoundError);

			mocks.auditRecord.mockRejectedValueOnce(new Error("audit insert failed"));
			await expect(service().assignToUserAtProvisioningInTx("new-user", "role-1", "inviter-1", db)).rejects.toThrow("audit insert failed");
		});
	});
});
