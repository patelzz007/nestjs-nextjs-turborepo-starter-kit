import { beforeEach, describe, expect, it } from "vitest";
import { epochMs } from "@workspace/shared";

import { systemActor, type ActorContext } from "../../../../platform/application/actor-context";
import {
	AccessDeniedError,
	PermissionAlreadyExistsError,
	PermissionNotFoundError,
	PermissionsNotFoundError,
	PlatformRoleNotConfiguredError,
	ProtectedRoleWithoutHolderError,
	RoleHierarchyCycleError,
	RoleLimitExceededError,
	RoleNameTakenError,
	SeparationOfDutyViolationError,
	SystemPermissionImmutableError,
	SystemRoleImmutableError,
} from "../../domain/errors/authorization.errors";
import { MAX_ROLES_PER_USER } from "../../domain/rbac-catalog";
import { AssignDefaultRoleCommand } from "../commands/assign-default-role/assign-default-role.command";
import { AssignDefaultRoleHandler } from "../commands/assign-default-role/assign-default-role.handler";
import { AssignRoleCommand } from "../commands/assign-role/assign-role.command";
import { AssignRoleHandler } from "../commands/assign-role/assign-role.handler";
import { CreatePermissionCommand } from "../commands/create-permission/create-permission.command";
import { CreatePermissionHandler } from "../commands/create-permission/create-permission.handler";
import { CreateRoleCommand } from "../commands/create-role/create-role.command";
import { CreateRoleHandler } from "../commands/create-role/create-role.handler";
import { ExpireTimeBoundPermissionOverridesCommand } from "../commands/expire-time-bound-permission-overrides/expire-time-bound-permission-overrides.command";
import {
	ExpireTimeBoundPermissionOverridesHandler,
	PERMISSION_EXPIRY_BATCH_ACCOUNTS,
} from "../commands/expire-time-bound-permission-overrides/expire-time-bound-permission-overrides.handler";
import { GrantUserPermissionCommand } from "../commands/grant-user-permission/grant-user-permission.command";
import { GrantUserPermissionHandler } from "../commands/grant-user-permission/grant-user-permission.handler";
import { RemovePermissionCommand } from "../commands/remove-permission/remove-permission.command";
import { RemovePermissionHandler } from "../commands/remove-permission/remove-permission.handler";
import { RemoveRoleCommand } from "../commands/remove-role/remove-role.command";
import { RemoveRoleHandler } from "../commands/remove-role/remove-role.handler";
import { ReparentRoleCommand } from "../commands/reparent-role/reparent-role.command";
import { ReparentRoleHandler } from "../commands/reparent-role/reparent-role.handler";
import { RestorePermissionCommand } from "../commands/restore-permission/restore-permission.command";
import { RestorePermissionHandler } from "../commands/restore-permission/restore-permission.handler";
import { RestoreRoleCommand } from "../commands/restore-role/restore-role.command";
import { RestoreRoleHandler } from "../commands/restore-role/restore-role.handler";
import { ReviseRoleCommand } from "../commands/revise-role/revise-role.command";
import { ReviseRoleHandler } from "../commands/revise-role/revise-role.handler";
import { RevisePermissionCommand } from "../commands/revise-permission/revise-permission.command";
import { RevisePermissionHandler } from "../commands/revise-permission/revise-permission.handler";
import { RevokeUserPermissionCommand } from "../commands/revoke-user-permission/revoke-user-permission.command";
import { RevokeUserPermissionHandler } from "../commands/revoke-user-permission/revoke-user-permission.handler";
import { SyncRolePermissionsCommand } from "../commands/sync-role-permissions/sync-role-permissions.command";
import { SyncRolePermissionsHandler } from "../commands/sync-role-permissions/sync-role-permissions.handler";
import { SyncUserPermissionsCommand } from "../commands/sync-user-permissions/sync-user-permissions.command";
import { SyncUserPermissionsHandler } from "../commands/sync-user-permissions/sync-user-permissions.handler";
import { SyncUserRolesCommand } from "../commands/sync-user-roles/sync-user-roles.command";
import { SyncUserRolesHandler } from "../commands/sync-user-roles/sync-user-roles.handler";
import { UnassignRoleCommand } from "../commands/unassign-role/unassign-role.command";
import { UnassignRoleHandler } from "../commands/unassign-role/unassign-role.handler";
import { RbacMutationGuard } from "../services/rbac-mutation-guard";
import { RbacMutationScope } from "../services/rbac-mutation-scope";
import { InMemoryAuthorizationStore, NOW, StoreBackedReach, adminActor, anonymousActor } from "./fakes/authorization.fakes";

const ADMIN = "admin-1";
const ROOT = "root-1";

let store: InMemoryAuthorizationStore;
let rbac: RbacMutationScope;
let guard: RbacMutationGuard;
const admin: ActorContext = adminActor(ADMIN);
const root: ActorContext = adminActor(ROOT, { isSuperAdmin: true });

/**
 * One small platform: an Admin who can read users (not delete them), a SuperAdmin, a Viewer role with a
 * child role, a Deleter role beyond the Admin's reach, and the two store roles that may not be combined.
 */
beforeEach(() => {
	store = new InMemoryAuthorizationStore();
	rbac = new RbacMutationScope(store.uow, store.clock);
	guard = new RbacMutationGuard(new StoreBackedReach(store.rbac));
	store.rbac.seedPermission({ id: "p-read", action: "READ", resource: "USER" });
	store.rbac.seedPermission({ id: "p-delete", action: "DELETE", resource: "USER" });
	store.rbac.seedRole({ id: "role-super", name: "SuperAdmin", isSystem: true });
	store.rbac.seedRole({ id: "role-admin", name: "Admin", isSystem: true }, ["p-read"]);
	store.rbac.seedRole({ id: "role-viewer", name: "Viewer" }, ["p-read"]);
	store.rbac.seedRole({ id: "role-child", name: "Junior Viewer", parentId: "role-viewer" });
	store.rbac.seedRole({ id: "role-deleter", name: "Deleter" }, ["p-delete"]);
	store.rbac.seedRole({ id: "role-manager", name: "Location Manager" });
	store.rbac.seedRole({ id: "role-staff", name: "Location Staff" });
	store.rbac.seedRole({ id: "role-user", name: "User", isSystem: true });
	store.rbac.seedUser(ADMIN, ["role-admin"]);
	store.rbac.seedUser(ROOT, ["role-super"], [], { isSuperAdmin: true });
	store.rbac.seedUser("user-1", ["role-child"]);
	store.rbac.seedUser("user-2", ["role-viewer"]);
});

function assign(actor: ActorContext, userId: string, roleId: string): Promise<void> {
	return new AssignRoleHandler(rbac, guard).execute(new AssignRoleCommand(actor, { userId, roleId }));
}

function rolesOf(userId: string): readonly string[] {
	return store.rbac.users.get(userId)?.roleIds ?? [];
}

describe("RbacMutationScope (through AssignRole)", () => {
	it("takes the RBAC lock, writes, revokes the target's sessions, audits as the admin and records the change, in one unit of work", async () => {
		await assign(admin, "user-2", "role-child");

		expect(rolesOf("user-2")).toEqual(["role-viewer", "role-child"]);
		expect(store.lock.acquired).toBe(1);
		expect(store.identitySessions.revocations).toEqual([{ userIds: ["user-2"], revokedBy: { kind: "user", userId: ADMIN } }]);
		expect(store.permissionAudit.entries).toEqual([{ action: "ROLE_ASSIGNED", targetUserId: "user-2", targetRoleId: "role-child", actor: { kind: "USER", userId: ADMIN } }]);
		expect(store.eventNames()).toEqual(["authorization.UserAuthorizationChanged"]);
		expect(store.uow.committed).toEqual([expect.objectContaining({ operation: "authorization.rbac.mutate" })]);
	});

	it("rolls everything back when a check after the write fails (separation of duties)", async () => {
		await assign(admin, "user-2", "role-manager");

		await expect(assign(admin, "user-2", "role-staff")).rejects.toBeInstanceOf(SeparationOfDutyViolationError);

		expect(rolesOf("user-2")).toEqual(["role-viewer", "role-manager"]);
		expect(store.permissionAudit.entries).toHaveLength(1);
		expect(store.identitySessions.revocations).toHaveLength(1);
	});

	it("refuses anyone but a signed-in administrator", async () => {
		await expect(assign(anonymousActor(), "user-2", "role-child")).rejects.toBeInstanceOf(AccessDeniedError);
		expect(store.lock.acquired).toBe(0);
	});
});

describe("Escalation rules", () => {
	it("forbids an Admin to hand out a role conferring what they do not hold", async () => {
		await expect(assign(admin, "user-2", "role-deleter")).rejects.toBeInstanceOf(AccessDeniedError);
		await assign(root, "user-2", "role-deleter");

		expect(rolesOf("user-2")).toContain("role-deleter");
	});

	it("forbids an Admin to change their own grants or a SuperAdmin's", async () => {
		await expect(assign(admin, ADMIN, "role-viewer")).rejects.toBeInstanceOf(AccessDeniedError);
		await expect(assign(admin, ROOT, "role-viewer")).rejects.toBeInstanceOf(AccessDeniedError);
	});

	it("forbids an Admin to edit a role in their own lineage, and never edits a system role", async () => {
		await expect(new ReviseRoleHandler(rbac, guard, store.clock).execute(new ReviseRoleCommand(root, "role-admin", { description: "x" }))).rejects.toBeInstanceOf(
			SystemRoleImmutableError,
		);
		store.rbac.seedUser(ADMIN, ["role-admin", "role-viewer"]);
		await expect(new ReviseRoleHandler(rbac, guard, store.clock).execute(new ReviseRoleCommand(admin, "role-viewer", { description: "x" }))).rejects.toBeInstanceOf(
			AccessDeniedError,
		);
	});
});

describe("User role assignments", () => {
	it("keeps the last holder of a protected role (D-last-holder)", async () => {
		await expect(new UnassignRoleHandler(rbac, guard).execute(new UnassignRoleCommand(root, { userId: ROOT, roleId: "role-super" }))).rejects.toBeInstanceOf(
			ProtectedRoleWithoutHolderError,
		);
		expect(rolesOf(ROOT)).toEqual(["role-super"]);
	});

	it("unassigns a role, revoking the user's sessions", async () => {
		await new UnassignRoleHandler(rbac, guard).execute(new UnassignRoleCommand(admin, { userId: "user-2", roleId: "role-viewer" }));

		expect(rolesOf("user-2")).toEqual([]);
		expect(store.identitySessions.revocations.at(-1)?.userIds).toEqual(["user-2"]);
	});

	it("syncs a user's roles within the per-user cap, checking reach on what is added and removed", async () => {
		const handler = new SyncUserRolesHandler(rbac, guard);

		await handler.execute(new SyncUserRolesCommand(admin, { userId: "user-2", roleIds: ["role-child", "role-child"] }));
		expect(rolesOf("user-2")).toEqual(["role-child"]);

		const tooMany = Array.from({ length: MAX_ROLES_PER_USER + 1 }, (_unused, index) => `role-${String(index)}`);
		await expect(handler.execute(new SyncUserRolesCommand(admin, { userId: "user-2", roleIds: tooMany }))).rejects.toBeInstanceOf(RoleLimitExceededError);
		await expect(handler.execute(new SyncUserRolesCommand(admin, { userId: "user-2", roleIds: ["role-deleter"] }))).rejects.toBeInstanceOf(AccessDeniedError);
	});

	it("attaches the default consumer role once, audited as the account itself", async () => {
		store.rbac.seedUser("new-user");
		const handler = new AssignDefaultRoleHandler(rbac, guard);

		await handler.execute(new AssignDefaultRoleCommand(anonymousActor(), "new-user"));
		await handler.execute(new AssignDefaultRoleCommand(anonymousActor(), "new-user"));

		expect(rolesOf("new-user")).toEqual(["role-user"]);
		expect(store.permissionAudit.entries).toEqual([expect.objectContaining({ action: "ROLE_ASSIGNED_AT_PROVISIONING", actor: { kind: "USER", userId: "new-user" } })]);
	});

	it("fails the signup when the consumer role was never configured", async () => {
		store.rbac.roles.delete("role-user");
		store.rbac.seedUser("new-user");

		await expect(new AssignDefaultRoleHandler(rbac, guard).execute(new AssignDefaultRoleCommand(anonymousActor(), "new-user"))).rejects.toBeInstanceOf(
			PlatformRoleNotConfiguredError,
		);
	});
});

describe("Role catalog changes", () => {
	it("creates a role under a parent within reach, refusing a taken name", async () => {
		const handler = new CreateRoleHandler(rbac, guard, store.clock);

		const created = await handler.execute(new CreateRoleCommand(admin, { name: "Support", parentId: "role-viewer" }));

		expect(created).toMatchObject({ name: "Support", parentId: "role-viewer" });
		expect(store.identitySessions.revocations.flatMap((revocation) => revocation.userIds)).toEqual([]);
		await expect(handler.execute(new CreateRoleCommand(admin, { name: "Viewer" }))).rejects.toBeInstanceOf(RoleNameTakenError);
		await expect(handler.execute(new CreateRoleCommand(admin, { name: "Cleaner", parentId: "role-deleter" }))).rejects.toBeInstanceOf(AccessDeniedError);
	});

	it("revises a role and signs out everyone holding it or a role below it", async () => {
		await new ReviseRoleHandler(rbac, guard, store.clock).execute(new ReviseRoleCommand(root, "role-viewer", { description: "read-only" }));

		expect([...(store.identitySessions.revocations.at(-1)?.userIds ?? [])].sort()).toEqual(["user-1", "user-2"]);
	});

	it("removes and restores a role, each reaching every holder of its lineage", async () => {
		await new RemoveRoleHandler(rbac, guard, store.clock).execute(new RemoveRoleCommand(root, "role-viewer"));
		expect(store.rbac.roles.get("role-viewer")?.isDeleted).toBe(true);

		await new RestoreRoleHandler(rbac, guard, store.clock).execute(new RestoreRoleCommand(root, "role-viewer"));
		expect(store.rbac.roles.get("role-viewer")?.isDeleted).toBe(false);
		expect(store.permissionAudit.entries.map((entry) => entry.action)).toEqual(["ROLE_DELETED", "ROLE_RESTORED"]);
		expect(store.identitySessions.revocations.map((revocation) => [...revocation.userIds].sort())).toEqual([
			["user-1", "user-2"],
			["user-1", "user-2"],
		]);
	});

	it("refuses to reparent a role under its own descendant", async () => {
		await expect(new ReparentRoleHandler(rbac, guard, store.clock).execute(new ReparentRoleCommand(root, "role-viewer", "role-child"))).rejects.toBeInstanceOf(
			RoleHierarchyCycleError,
		);
		expect(store.rbac.roles.get("role-viewer")?.parentId).toBeNull();
	});

	it("syncs a role's permissions within reach, refusing unknown ones", async () => {
		const handler = new SyncRolePermissionsHandler(rbac, guard, store.clock);

		await expect(handler.execute(new SyncRolePermissionsCommand(admin, "role-viewer", ["p-delete"]))).rejects.toBeInstanceOf(AccessDeniedError);
		await expect(handler.execute(new SyncRolePermissionsCommand(root, "role-viewer", ["p-ghost"]))).rejects.toBeInstanceOf(PermissionsNotFoundError);
		await handler.execute(new SyncRolePermissionsCommand(root, "role-viewer", ["p-read", "p-delete"]));

		expect(store.rbac.rolePermissions.get("role-viewer")).toEqual(["p-read", "p-delete"]);
		expect(store.rbac.heldPermissionKeys("user-1").has("DELETE:USER")).toBe(true);
	});
});

describe("Permission catalog changes", () => {
	it("creates a permission once per action and resource, affecting nobody", async () => {
		const handler = new CreatePermissionHandler(rbac, store.clock);

		await expect(handler.execute(new CreatePermissionCommand(admin, { action: "READ", resource: "USER" }))).rejects.toBeInstanceOf(PermissionAlreadyExistsError);
		await handler.execute(new CreatePermissionCommand(admin, { action: "UPDATE", resource: "USER", group: "Users" }));

		expect(store.identitySessions.revocations.flatMap((revocation) => revocation.userIds)).toEqual([]);
		expect(store.permissionAudit.entries.map((entry) => entry.action)).toEqual(["PERMISSION_CREATED"]);
	});

	it("removing a permission signs out holders of roles inheriting it, too", async () => {
		await new RemovePermissionHandler(rbac, guard, store.clock).execute(new RemovePermissionCommand(root, "p-read"));

		expect([...(store.identitySessions.revocations.at(-1)?.userIds ?? [])].sort()).toEqual([ADMIN, "user-1", "user-2"]);
		await new RestorePermissionHandler(rbac, guard, store.clock).execute(new RestorePermissionCommand(root, "p-read"));
		expect(store.rbac.permissions.get("p-read")?.isDeleted).toBe(false);
	});

	it("revises a permission's metadata without touching anyone's sessions, never a system one", async () => {
		store.rbac.seedPermission({ id: "p-system", action: "MANAGE", resource: "SYSTEM_SETTINGS", isSystem: true });
		const handler = new RevisePermissionHandler(rbac, store.clock);

		await expect(handler.execute(new RevisePermissionCommand(admin, "p-read", { group: "Accounts" }))).resolves.toMatchObject({ group: "Accounts" });
		await expect(handler.execute(new RevisePermissionCommand(root, "p-system", { group: "x" }))).rejects.toBeInstanceOf(SystemPermissionImmutableError);
		await expect(handler.execute(new RevisePermissionCommand(root, "p-ghost", { group: "x" }))).rejects.toBeInstanceOf(PermissionNotFoundError);
		expect(store.identitySessions.revocations.flatMap((revocation) => revocation.userIds)).toEqual([]);
	});

	it("forbids an Admin to remove a permission they do not hold", async () => {
		await expect(new RemovePermissionHandler(rbac, guard, store.clock).execute(new RemovePermissionCommand(admin, "p-delete"))).rejects.toBeInstanceOf(AccessDeniedError);
	});
});

describe("Direct permission overrides", () => {
	it("grants and revokes an override within reach", async () => {
		await new GrantUserPermissionHandler(rbac, guard).execute(
			new GrantUserPermissionCommand(admin, { userId: "user-2", permissionId: "p-read", effect: "DENY", expiresAt: undefined }),
		);
		expect(store.rbac.heldPermissionKeys("user-2").has("READ:USER")).toBe(false);

		await new RevokeUserPermissionHandler(rbac, guard).execute(new RevokeUserPermissionCommand(admin, { userId: "user-2", permissionId: "p-read" }));
		expect(store.rbac.heldPermissionKeys("user-2").has("READ:USER")).toBe(true);
		await expect(
			new GrantUserPermissionHandler(rbac, guard).execute(
				new GrantUserPermissionCommand(admin, { userId: "user-2", permissionId: "p-delete", effect: "ALLOW", expiresAt: undefined }),
			),
		).rejects.toBeInstanceOf(AccessDeniedError);
	});

	it("syncs the ALLOW set", async () => {
		await new SyncUserPermissionsHandler(rbac, guard).execute(new SyncUserPermissionsCommand(root, { userId: "user-2", permissionIds: ["p-delete"] }));

		expect(store.rbac.users.get("user-2")?.overrides).toEqual([expect.objectContaining({ permissionId: "p-delete", effect: "ALLOW" })]);
	});

	it("expires overrides past their time as the system, one audit row each, nothing when none is due", async () => {
		await new GrantUserPermissionHandler(rbac, guard).execute(
			new GrantUserPermissionCommand(root, { userId: "user-2", permissionId: "p-delete", effect: "ALLOW", expiresAt: epochMs(NOW + 1000) }),
		);
		const expiry = new ExpireTimeBoundPermissionOverridesHandler(rbac, store.clock);
		const job = systemActor("maintenance.permission_expiry", "cron", null, "expire overrides", null);
		if (job.kind !== "system") {
			throw new Error("expected a system actor");
		}

		await expect(expiry.execute(new ExpireTimeBoundPermissionOverridesCommand(job))).resolves.toBe(0);
		store.clock.advance(2000);
		await expect(expiry.execute(new ExpireTimeBoundPermissionOverridesCommand(job))).resolves.toBe(1);

		expect(store.permissionAudit.entries.at(-1)).toMatchObject({
			action: "PERMISSION_EXPIRED",
			actor: { kind: "SYSTEM_OPERATION", operation: "maintenance.permission_expiry" },
		});
		expect(store.identitySessions.revocations.at(-1)?.revokedBy).toEqual({ kind: "system", marker: "system:rbac-mutation" });
	});

	it("expires a backlog larger than one batch, one RBAC transaction per batch of accounts", async () => {
		const accounts = PERMISSION_EXPIRY_BATCH_ACCOUNTS + 1;
		for (let index = 0; index < accounts; index += 1) {
			store.rbac.seedUser(
				`expiring-${String(index).padStart(4, "0")}`,
				[],
				[{ id: `override-${String(index)}`, permissionId: "p-delete", effect: "ALLOW", expiresAt: NOW - 1 }],
			);
		}
		const job = systemActor("maintenance.permission_expiry", "cron", null, "expire overrides", null);
		if (job.kind !== "system") {
			throw new Error("expected a system actor");
		}
		const audited = store.permissionAudit.entries.length;

		await expect(new ExpireTimeBoundPermissionOverridesHandler(rbac, store.clock).execute(new ExpireTimeBoundPermissionOverridesCommand(job))).resolves.toBe(accounts);

		expect(store.permissionAudit.entries.length - audited).toBe(accounts);
		expect([...store.rbac.users.values()].filter((user) => user.overrides.some((override) => override.expiresAt !== null && override.expiresAt < NOW))).toEqual([]);
	});
});
