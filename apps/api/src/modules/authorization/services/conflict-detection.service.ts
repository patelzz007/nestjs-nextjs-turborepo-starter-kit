import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { ConflictError } from "../../../common/errors/app-error";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { ROLE_SEPARATION_OF_DUTY_RULES, type RoleSeparationOfDutyRule } from "../constants/authorization.constants";
import { RoleAssignmentRepository } from "../repositories/role-assignment.repository";
import { RoleRepository } from "../repositories/role.repository";

/** A violated separation-of-duty rule. */
export type RoleConflict = RoleSeparationOfDutyRule;

/**
 * Detects authorization configurations that must never exist:
 *
 * 1. **Separation of duties** — a user's *effective* role set (directly
 *    assigned active roles plus every active ancestor they inherit) must not
 *    contain both roles of any {@link ROLE_SEPARATION_OF_DUTY_RULES} pair.
 *    Enforced after every write that changes an effective role set (assign,
 *    sync, re-parent, restore, re-activate), inside the same transaction, so
 *    a violating change rolls back.
 * 2. **ALLOW + DENY on the same permission** — a direct-permission sync may
 *    not list a permission the user holds a live DENY override for; the DENY
 *    must be lifted explicitly (an escalation-checked revoke) first. (A
 *    single grant replaces the override row, so the two cannot coexist.)
 *
 * A DENY override that shadows a permission a role grants is *not* a
 * conflict: that is exactly what DENY overrides are for.
 */
@Injectable()
export class ConflictDetectionService {
	public constructor(
		private readonly roles: RoleRepository,
		private readonly assignments: RoleAssignmentRepository,
		private readonly tenantTx: TenantTransactionService,
	) {}

	/** Separation-of-duty rules violated by holding all of `roleIds` (with their active ancestors) at once. */
	public async findConflicts(roleIds: readonly string[], db: Prisma.TransactionClient): Promise<RoleConflict[]> {
		const names: ReadonlySet<string> = await this.effectiveRoleNames(roleIds, db);
		return ROLE_SEPARATION_OF_DUTY_RULES.filter((rule: RoleSeparationOfDutyRule): boolean => names.has(rule.roleA) && names.has(rule.roleB));
	}

	/** @throws ConflictError when `roleIds` together violate a separation-of-duty rule. */
	public async assertNoConflicts(roleIds: readonly string[], db: Prisma.TransactionClient): Promise<void> {
		const conflicts: RoleConflict[] = await this.findConflicts(roleIds, db);
		if (conflicts.length > 0) {
			const messages: string[] = conflicts.map((conflict: RoleConflict): string => `"${conflict.roleA}" conflicts with "${conflict.roleB}": ${conflict.reason}`);
			throw new ConflictError({ message: `Role assignment rejected: ${messages.join("; ")}` });
		}
	}

	/** Post-write check: every user in `userIds` must hold a conflict-free effective role set. */
	public async assertUsersHaveNoConflicts(userIds: readonly string[], db: Prisma.TransactionClient): Promise<void> {
		for (const userId of new Set<string>(userIds)) {
			await this.assertNoConflicts(await this.assignments.findAssignedRoleIds(userId, db), db);
		}
	}

	/**
	 * Dry run for `POST /admin/roles/:id/validate-assignment`: would assigning
	 * `roleIds` in addition to the user's current roles violate a rule?
	 * Reads the target's assignments (own-row RLS) under the allowlisted
	 * `authorization.rbac.inspect` operation — the route permission check has
	 * already run.
	 */
	public async validateProposedAssignment(actorId: string, userId: string, roleIds: readonly string[]): Promise<void> {
		await this.tenantTx.withSystemOperation(
			{ operation: "authorization.rbac.inspect", reason: "Validate a proposed role assignment against separation-of-duty rules", actorUserId: actorId },
			async (tx: Prisma.TransactionClient): Promise<void> => {
				const current: string[] = await this.assignments.findAssignedRoleIds(userId, tx);
				await this.assertNoConflicts([...current, ...roleIds], tx);
			},
		);
	}

	/** @throws ConflictError when a direct ALLOW sync lists a permission the user holds a live DENY override for. */
	public async assertNoAllowDenyConflict(userId: string, allowPermissionIds: readonly string[], db: Prisma.TransactionClient): Promise<void> {
		const listed: ReadonlySet<string> = new Set<string>(allowPermissionIds);
		const overrides = await this.assignments.findDirectOverrides(userId, db);
		const denied: string[] = overrides
			.filter((override): boolean => override.effect === "DENY" && listed.has(override.permissionId))
			.map((override): string => override.permissionId);
		if (denied.length > 0) {
			throw new ConflictError({
				message: `Permission sync rejected: the user has a DENY override for ${String(denied.length)} listed permission(s); revoke the override explicitly first`,
			});
		}
	}

	/** Names of the active roles among `roleIds` plus every active ancestor (the hierarchy the kernel evaluates). */
	private async effectiveRoleNames(roleIds: readonly string[], db: Prisma.TransactionClient): Promise<ReadonlySet<string>> {
		const collected = new Set<string>();
		let frontier: string[] = [...new Set<string>(roleIds)];
		while (frontier.length > 0) {
			const links = await this.roles.findEffectiveParentLinks(frontier, db);
			for (const link of links) {
				collected.add(link.id);
			}
			frontier = links.flatMap((link): string[] => (link.parentId !== null && !collected.has(link.parentId) ? [link.parentId] : []));
		}
		const names: Map<string, string> = await this.roles.findEffectiveNames([...collected], db);
		return new Set<string>(names.values());
	}
}
