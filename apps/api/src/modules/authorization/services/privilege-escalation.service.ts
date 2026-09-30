import { Injectable } from "@nestjs/common";
import type { PermissionPair } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";
import { AuthorizationException } from "../exceptions/authorization.exception";
import { AuthorizationKernelService } from "../kernel/authorization-kernel.service";

/** The authenticated administrator performing an authorization-management change. */
export interface AuthorizationActor {
	readonly id: string;
	readonly isSuperAdmin: boolean;
}

/**
 * Privilege-escalation guard for authorization administration (spec §68, §69).
 *
 * Rules (platform SuperAdmins are exempt — they already hold everything):
 * 1. **No self-escalation** — an actor cannot change their own role
 *    assignments or direct permissions, nor edit a role they currently hold
 *    (directly or through the hierarchy).
 * 2. **Subset rule** — an actor can only grant, assign, or make inheritable
 *    permissions they themselves currently hold with GLOBAL reach.
 *
 * Route decorators still require ROLE / PERMISSION management permissions;
 * these checks run on top of them, against the exact payload being applied.
 */
@Injectable()
export class PrivilegeEscalationService {
	public constructor(
		private readonly prisma: PrismaService,
		private readonly kernel: AuthorizationKernelService,
	) {}

	/** Reject changes to the actor's own assignments. */
	public assertNotSelf(actor: AuthorizationActor, targetUserId: string): void {
		if (!actor.isSuperAdmin && actor.id === targetUserId) {
			throw new AuthorizationException();
		}
	}

	/** Reject edits to a role the actor holds (directly or via inheritance). */
	public async assertNotHoldingRole(actor: AuthorizationActor, roleId: string): Promise<void> {
		if (actor.isSuperAdmin) {
			return;
		}
		const heldRoleIds = await this.heldRoleIds(actor.id);
		if (heldRoleIds.has(roleId)) {
			throw new AuthorizationException();
		}
	}

	/** Every permission in `permissionIds` must already be held by the actor. */
	public async assertCanGrantPermissions(actor: AuthorizationActor, permissionIds: readonly string[]): Promise<void> {
		if (actor.isSuperAdmin || permissionIds.length === 0) {
			return;
		}
		const permissions = await this.prisma.permission.findMany({
			where: { id: { in: [...permissionIds] }, isDeleted: false },
			select: { action: true, resource: true },
		});
		await this.assertHoldsAll(actor, permissions);
	}

	/** Every permission the roles confer (including inherited ones) must already be held by the actor. */
	public async assertCanGrantRoles(actor: AuthorizationActor, roleIds: readonly string[]): Promise<void> {
		if (actor.isSuperAdmin || roleIds.length === 0) {
			return;
		}
		const effectiveRoleIds = await this.withAncestors(roleIds);
		const rolePermissions = await this.prisma.rolePermission.findMany({
			where: { roleId: { in: effectiveRoleIds }, isDeleted: false, permission: { isDeleted: false } },
			select: { permission: { select: { action: true, resource: true } } },
		});
		await this.assertHoldsAll(
			actor,
			rolePermissions.map((rolePermission) => rolePermission.permission),
		);
	}

	private async assertHoldsAll(actor: AuthorizationActor, required: readonly PermissionPair[]): Promise<void> {
		const unique = new Map<string, PermissionPair>();
		for (const pair of required) {
			unique.set(`${pair.action}:${pair.resource}`, pair);
		}
		for (const pair of unique.values()) {
			// No tenant, no resource: only GLOBAL grants count as "holding" a permission.
			const decision = await this.kernel.can({ subject: { userId: actor.id, isSuperAdmin: false }, action: pair.action, resource: pair.resource });
			if (decision !== "ALLOW") {
				throw new AuthorizationException();
			}
		}
	}

	private async heldRoleIds(userId: string): Promise<Set<string>> {
		const direct = await this.prisma.userRole.findMany({
			where: { userId, isDeleted: false, role: { isDeleted: false } },
			select: { roleId: true },
		});
		return new Set(await this.withAncestors(direct.map((row) => row.roleId)));
	}

	private async withAncestors(roleIds: readonly string[]): Promise<string[]> {
		const collected = new Set<string>();
		let frontier: string[] = [...roleIds];
		while (frontier.length > 0) {
			const next: string[] = [];
			for (const id of frontier) {
				collected.add(id);
			}
			const roles = await this.prisma.role.findMany({
				where: { id: { in: frontier }, isDeleted: false },
				select: { parentId: true },
			});
			for (const role of roles) {
				if (role.parentId !== null && !collected.has(role.parentId)) {
					next.push(role.parentId);
				}
			}
			frontier = next;
		}
		return Array.from(collected);
	}
}
