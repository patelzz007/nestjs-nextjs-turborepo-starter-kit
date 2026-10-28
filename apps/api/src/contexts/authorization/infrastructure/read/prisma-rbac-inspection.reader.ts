import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { nowEpochMs } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import { RBAC_INSPECT_OPERATION } from "../../application/ports/authorization.tokens";
import type { DirectOverrideKeys, EffectiveRoleSet, RbacInspectionReader, RbacInspectionReadPort } from "../../application/ports/rbac-read.port";
import { permissionKeyOf } from "../../domain/rbac-catalog";
import { PrismaRbacGraphReader } from "../persistence/prisma-rbac-graph.reader";

/** The administrator behind an inspection (the audited actor of the system operation), or `null` for a non-user actor. */
function actorUserIdOf(actor: ActorContext): string | null {
	if (actor.kind === "user") {
		return actor.userId;
	}
	return actor.kind === "system" ? actor.actorUserId : null;
}

/**
 * Mirrors the kernel's grant resolution: active, non-deleted roles (flat — no inheritance);
 * live role permissions; live, unexpired direct ALLOW / DENY overrides.
 */
class PrismaInspectionReader implements RbacInspectionReader {
	private readonly graph: PrismaRbacGraphReader;

	public constructor(private readonly db: Prisma.TransactionClient) {
		this.graph = new PrismaRbacGraphReader(db);
	}

	public async assignedRoleIds(userId: string): Promise<string[]> {
		return this.graph.assignedRoleIds(userId);
	}

	public async activeRoleNames(roleIds: readonly string[]): Promise<ReadonlySet<string>> {
		return this.graph.activeRoleNames(roleIds);
	}

	public async effectiveRoleSet(roleIds: readonly string[]): Promise<EffectiveRoleSet> {
		if (roleIds.length === 0) {
			return { roleNames: [], permissionKeys: [] };
		}
		const direct = await this.db.role.findMany({ where: { id: { in: [...roleIds] }, isDeleted: false, isActive: true }, select: { id: true, name: true } });
		const rolePermissions = await this.db.rolePermission.findMany({
			where: { roleId: { in: direct.map((role): string => role.id) }, isDeleted: false, permission: { isDeleted: false } },
			select: { permission: { select: { action: true, resource: true } } },
		});
		return {
			roleNames: direct.map((role): string => role.name),
			permissionKeys: [...new Set<string>(rolePermissions.map((row): string => permissionKeyOf(row.permission)))],
		};
	}

	public async directOverrideKeys(userId: string): Promise<DirectOverrideKeys> {
		const nowMs: number = nowEpochMs();
		const rows = await this.db.userPermission.findMany({
			where: { userId, isDeleted: false, permission: { isDeleted: false }, OR: [{ expiresAt: null }, { expiresAt: { gt: nowMs } }] },
			select: { effect: true, permission: { select: { action: true, resource: true } } },
		});
		return {
			allow: rows.filter((row): boolean => row.effect === "ALLOW").map((row): string => permissionKeyOf(row.permission)),
			deny: rows.filter((row): boolean => row.effect === "DENY").map((row): string => permissionKeyOf(row.permission)),
		};
	}
}

/** Another user's assignments are own-row RLS tables: read under `authorization.rbac.inspect`, after the route check. */
@Injectable()
export class PrismaRbacInspectionReadAdapter implements RbacInspectionReadPort {
	public constructor(private readonly tenantTx: TenantTransactionService) {}

	public async inspect<TResult>(actor: ActorContext, reason: string, work: (reader: RbacInspectionReader) => Promise<TResult>): Promise<TResult> {
		return this.tenantTx.withSystemOperation({ operation: RBAC_INSPECT_OPERATION, reason, actorUserId: actorUserIdOf(actor) }, async (db: Prisma.TransactionClient) =>
			work(new PrismaInspectionReader(db)),
		);
	}
}
