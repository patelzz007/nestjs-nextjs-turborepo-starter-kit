import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import { RoleAssignmentRepository } from "./role-assignment.repository";

/** Records every write the repository issues inside its transaction, in order. */
const mocks = vi.hoisted(() => ({
	calls: new Array<{ readonly model: string; readonly op: string; readonly args: object }>(),
}));

function recorder(model: string): Record<"updateMany" | "createMany", (args: object) => Promise<{ count: number }>> {
	return {
		updateMany: async (args: object) => {
			mocks.calls.push({ model, op: "updateMany", args });
			return { count: 1 };
		},
		createMany: async (args: object) => {
			mocks.calls.push({ model, op: "createMany", args });
			return { count: 1 };
		},
	};
}

vi.mock("../../../prisma/prisma.service", () => ({
	PrismaService: class {
		public readonly $transaction = async (work: (tx: object) => Promise<void>): Promise<void> => {
			await work({ rolePermission: recorder("rolePermission"), userRole: recorder("userRole"), userPermission: recorder("userPermission") });
		};
	},
}));

/**
 * Regression: sync soft-deleted every row, then `createMany({ skipDuplicates })`
 * skipped rows that already existed (unique key), so re-synced assignments
 * stayed deleted. Each sync must revive listed rows before inserting new ones.
 */
describe("RoleAssignmentRepository sync", () => {
	beforeEach(() => {
		mocks.calls.length = 0;
	});

	it("revives existing user roles instead of leaving them soft-deleted", async () => {
		await new RoleAssignmentRepository(new PrismaService()).syncUserRoles("user-1", ["role-a", "role-b"]);

		expect(mocks.calls.map((call) => call.op)).toEqual(["updateMany", "updateMany", "createMany"]);
		expect(mocks.calls[1]).toEqual({
			model: "userRole",
			op: "updateMany",
			args: { where: { userId: "user-1", roleId: { in: ["role-a", "role-b"] } }, data: { isDeleted: false, deletedAt: null } },
		});
	});

	it("revives existing role permissions", async () => {
		await new RoleAssignmentRepository(new PrismaService()).syncRolePermissions("role-1", ["perm-a"]);

		expect(mocks.calls[1]).toEqual({
			model: "rolePermission",
			op: "updateMany",
			args: { where: { roleId: "role-1", permissionId: { in: ["perm-a"] } }, data: { isDeleted: false, deletedAt: null } },
		});
	});

	it("revives existing direct permissions as ALLOW grants without expiry", async () => {
		await new RoleAssignmentRepository(new PrismaService()).syncUserPermissions("user-1", ["perm-a"]);

		expect(mocks.calls[1]).toEqual({
			model: "userPermission",
			op: "updateMany",
			args: { where: { userId: "user-1", permissionId: { in: ["perm-a"] } }, data: { isDeleted: false, deletedAt: null, effect: "ALLOW", expiresAt: null } },
		});
	});

	it("only clears assignments when syncing to an empty set", async () => {
		await new RoleAssignmentRepository(new PrismaService()).syncUserRoles("user-1", []);

		expect(mocks.calls.map((call) => call.op)).toEqual(["updateMany"]);
	});
});
