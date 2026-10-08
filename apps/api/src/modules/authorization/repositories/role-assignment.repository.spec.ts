import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LIST_SLOT_INDEX } from "@workspace/shared";

import { createTestPrisma } from "../../../../test/support/test-service-graph";
import { RoleAssignmentRepository } from "./role-assignment.repository";

/** Records every write the repository issues on the transaction client, in order. */
const mocks = vi.hoisted(() => ({
	calls: new Array<{ readonly model: string; readonly op: string; readonly args: object }>(),
}));

function recorder(model: string): Record<"updateMany" | "createMany", (args: object) => Promise<{ count: number }>> {
	return {
		updateMany: (args: object): Promise<{ count: number }> => {
			mocks.calls.push({ model, op: "updateMany", args });
			return Promise.resolve({ count: 1 });
		},
		createMany: (args: object): Promise<{ count: number }> => {
			mocks.calls.push({ model, op: "createMany", args });
			return Promise.resolve({ count: 1 });
		},
	};
}

vi.mock("../../../prisma/prisma.service", () => ({
	PrismaService: class {
		public readonly rolePermission = recorder("rolePermission");
		public readonly userRole = recorder("userRole");
		public readonly userPermission = recorder("userPermission");
	},
}));

const NOW = 1_790_812_800_000;

/**
 * Sync writes run on the caller's transaction client (the RBAC mutation
 * transaction). Regression: listed rows that already existed (soft-deleted)
 * must be revived — `createMany({ skipDuplicates })` skips them.
 */
describe("RoleAssignmentRepository sync", () => {
	beforeEach(() => {
		mocks.calls.length = 0;
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("soft-deletes only unlisted user roles, revives deleted listed rows, then inserts new ones — all on the given client", async () => {
		await new RoleAssignmentRepository().syncUserRoles("user-1", ["role-a", "role-b"], "admin-1", createTestPrisma());

		expect(mocks.calls.map((call) => `${call.model}.${call.op}`)).toEqual(["userRole.updateMany", "userRole.updateMany", "userRole.createMany"]);
		expect(mocks.calls[LIST_SLOT_INDEX.first]?.args).toEqual({
			where: { userId: "user-1", isDeleted: false, roleId: { notIn: ["role-a", "role-b"] } },
			data: { isDeleted: true, deletedAt: NOW, updatedAt: NOW },
		});
		expect(mocks.calls[LIST_SLOT_INDEX.second]?.args).toEqual({
			where: { userId: "user-1", roleId: { in: ["role-a", "role-b"] }, isDeleted: true },
			data: { isDeleted: false, deletedAt: null, assignedBy: "admin-1", assignedAt: NOW, updatedAt: NOW },
		});
		expect(mocks.calls[LIST_SLOT_INDEX.third]?.args).toEqual({
			data: [
				{ userId: "user-1", roleId: "role-a", assignedBy: "admin-1" },
				{ userId: "user-1", roleId: "role-b", assignedBy: "admin-1" },
			],
			skipDuplicates: true,
		});
	});

	it("revives existing role permissions and stamps the assigning actor", async () => {
		await new RoleAssignmentRepository().syncRolePermissions("role-1", ["perm-a"], "admin-1", createTestPrisma());

		expect(mocks.calls[LIST_SLOT_INDEX.second]).toEqual({
			model: "rolePermission",
			op: "updateMany",
			args: {
				where: { roleId: "role-1", permissionId: { in: ["perm-a"] }, isDeleted: true },
				data: { isDeleted: false, deletedAt: null, assignedBy: "admin-1", assignedAt: NOW, updatedAt: NOW },
			},
		});
	});

	it("never touches DENY overrides when syncing direct ALLOW grants (a sync cannot turn a DENY into an ALLOW)", async () => {
		await new RoleAssignmentRepository().syncUserAllowGrants("user-1", ["perm-a"], "admin-1", createTestPrisma());

		const updates = mocks.calls.filter((call) => call.op === "updateMany");
		expect(updates[LIST_SLOT_INDEX.first]?.args).toEqual({
			where: { userId: "user-1", isDeleted: false, effect: "ALLOW", permissionId: { notIn: ["perm-a"] } },
			data: { isDeleted: true, deletedAt: NOW, updatedAt: NOW },
		});
		// Only soft-deleted rows are revived (as ALLOW); a live DENY row is never rewritten.
		expect(updates[LIST_SLOT_INDEX.second]?.args).toEqual({
			where: { userId: "user-1", permissionId: { in: ["perm-a"] }, isDeleted: true },
			data: { isDeleted: false, deletedAt: null, effect: "ALLOW", expiresAt: null, assignedBy: "admin-1", assignedAt: NOW, updatedAt: NOW },
		});
		expect(updates[LIST_SLOT_INDEX.third]?.args).toEqual({
			where: { userId: "user-1", permissionId: { in: ["perm-a"] }, isDeleted: false, effect: "ALLOW" },
			data: { expiresAt: null, updatedAt: NOW },
		});
	});

	it("only clears assignments when syncing to an empty set", async () => {
		await new RoleAssignmentRepository().syncUserRoles("user-1", [], "admin-1", createTestPrisma());

		expect(mocks.calls.map((call) => call.op)).toEqual(["updateMany"]);
	});
});
