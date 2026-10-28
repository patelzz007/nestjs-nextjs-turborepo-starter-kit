import { describe, expect, it } from "vitest";
import { epochMs, type EpochMs } from "@workspace/shared";

import { PermissionAggregate, type PermissionState } from "../aggregates/permission.aggregate";
import { RoleAggregate, ROLE_NAME_MAX_LENGTH, type RoleState } from "../aggregates/role.aggregate";
import { DeletedPermissionNotFoundError, DeletedRoleNotFoundError, SystemPermissionImmutableError, SystemRoleImmutableError } from "../errors/authorization.errors";
import { CorruptAggregateStateError } from "../../../../platform/domain/errors/corrupt-aggregate-state.error";

const NOW: EpochMs = epochMs(1_800_000_000_000);
const LATER: EpochMs = epochMs(NOW + 1);

function role(overrides: Partial<RoleState> = {}): RoleAggregate {
	return RoleAggregate.rehydrate({
		id: "role-1",
		name: "Location Manager",
		description: null,
		isActive: true,
		isSystem: false,
		isDeleted: false,
		deletedAt: null,
		createdAt: NOW,
		updatedAt: NOW,
		...overrides,
	});
}

function permission(overrides: Partial<PermissionState> = {}): PermissionAggregate {
	return PermissionAggregate.rehydrate({
		id: "perm-1",
		action: "CREATE",
		resource: "USER",
		scope: "GLOBAL",
		description: null,
		group: null,
		isSystem: false,
		isDeleted: false,
		deletedAt: null,
		createdAt: NOW,
		updatedAt: NOW,
		...overrides,
	});
}

describe("RoleAggregate", () => {
	it("creates an active custom role and records the creation", () => {
		const created = RoleAggregate.create({ id: "role-2", name: "Auditor", description: "reads" }, NOW);

		expect(created.snapshot()).toMatchObject({ isActive: true, isSystem: false, isDeleted: false, createdAt: NOW });
		expect(created.pullChanges()).toEqual([{ kind: "created" }]);
		expect(created.pullChanges()).toEqual([]);
	});

	it("revises only the given fields and knows a rename", () => {
		const subject = role();

		expect(subject.isRenamedBy({ name: "Location Manager" })).toBe(false);
		expect(subject.isRenamedBy({ name: "Shift Lead" })).toBe(true);
		subject.revise({ description: "runs the store" }, LATER);

		expect(subject.snapshot()).toMatchObject({ name: "Location Manager", description: "runs the store", updatedAt: LATER });
		expect(() => {
			subject.revise({ name: "x".repeat(ROLE_NAME_MAX_LENGTH + 1) }, LATER);
		}).toThrow();
	});

	it("never changes a system role", () => {
		const system = role({ isSystem: true, name: "SuperAdmin" });

		expect(() => {
			system.revise({ description: "x" }, LATER);
		}).toThrow(SystemRoleImmutableError);
		expect(() => {
			system.remove(LATER);
		}).toThrow(SystemRoleImmutableError);
		expect(() => {
			system.syncPermissions([], "admin-1", LATER);
		}).toThrow(SystemRoleImmutableError);
	});

	it("soft-deletes and restores (reactivated), refusing to restore a live role", () => {
		const subject = role();

		subject.remove(LATER);
		expect(subject.snapshot()).toMatchObject({ isDeleted: true, deletedAt: LATER });
		subject.restore(LATER);
		expect(subject.snapshot()).toMatchObject({ isDeleted: false, deletedAt: null, isActive: true });
		expect(() => {
			subject.restore(LATER);
		}).toThrow(DeletedRoleNotFoundError);
	});

	it("syncs a de-duplicated permission set", () => {
		const subject = role();

		subject.syncPermissions(["perm-1", "perm-2", "perm-1"], "admin-1", LATER);

		expect(subject.pullChanges()).toEqual([{ kind: "permissions_synced", permissionIds: ["perm-1", "perm-2"], assignedBy: "admin-1" }]);
	});

	it("refuses a corrupt stored row", () => {
		expect(() => role({ name: "" })).toThrow(CorruptAggregateStateError);
	});
});

describe("PermissionAggregate", () => {
	it("creates a global custom permission keyed by action:resource", () => {
		const created = PermissionAggregate.create({ id: "perm-2", action: "READ", resource: "USER", description: null, group: "Users" }, NOW);

		expect(created.key).toBe("READ:USER");
		expect(created.pair).toEqual({ action: "READ", resource: "USER" });
		expect(created.snapshot()).toMatchObject({ scope: "GLOBAL", isSystem: false });
	});

	it("revises, removes and restores a custom permission, never a system one", () => {
		const subject = permission();

		subject.revise({ group: "Accounts" }, LATER);
		subject.remove(LATER);
		subject.restore(LATER);

		expect(subject.pullChanges().map((change) => change.kind)).toEqual(["revised", "removed", "restored"]);
		expect(() => {
			subject.restore(LATER);
		}).toThrow(DeletedPermissionNotFoundError);
		expect(() => {
			permission({ isSystem: true }).remove(LATER);
		}).toThrow(SystemPermissionImmutableError);
	});

	it("refuses a corrupt stored row", () => {
		expect(() => permission({ group: "x".repeat(101) })).toThrow(CorruptAggregateStateError);
	});
});
