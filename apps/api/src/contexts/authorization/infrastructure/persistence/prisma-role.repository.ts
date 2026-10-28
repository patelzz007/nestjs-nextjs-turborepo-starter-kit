import type { Prisma, Role } from "@prisma/client";

import type { RoleAggregate, RoleChange, RoleRevision, RoleState } from "../../domain/aggregates/role.aggregate";
import type { RoleRepository } from "../../domain/repositories/role.repository";
import { roleAggregateOf, roleStateOf } from "./rbac-row.mapper";

function revisionData(revision: RoleRevision, updatedAt: number): Prisma.RoleUpdateInput {
	return {
		...(revision.name === undefined ? {} : { name: revision.name }),
		...(revision.description === undefined ? {} : { description: revision.description }),
		...(revision.isActive === undefined ? {} : { isActive: revision.isActive }),
		updatedAt,
	};
}

/**
 * `Role` and `RolePermission` on the RBAC transaction. Soft delete only: a removed role, and a
 * permission dropped from a role, keep their rows with `is_deleted = true`.
 */
/**
 * The platform's role set: platform roles and the tenant-role templates (no tenant). A tenant's own roles
 * are administered by the tenant (`TenantAccessService`, ADR 067), never through the platform RBAC routes.
 */
const PLATFORM_SET = { tenantId: null } satisfies Prisma.RoleWhereInput;

export class PrismaRoleRepository implements RoleRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async findLive(roleId: string): Promise<RoleAggregate | null> {
		const row: Role | null = await this.db.role.findFirst({ where: { id: roleId, isDeleted: false, ...PLATFORM_SET } });
		return row === null ? null : roleAggregateOf(row);
	}

	public async findIncludingDeleted(roleId: string): Promise<RoleAggregate | null> {
		const row: Role | null = await this.db.role.findFirst({ where: { id: roleId, ...PLATFORM_SET } });
		return row === null ? null : roleAggregateOf(row);
	}

	public async findLiveByName(name: string): Promise<RoleAggregate | null> {
		const row: Role | null = await this.db.role.findFirst({ where: { name, isDeleted: false, ...PLATFORM_SET } });
		return row === null ? null : roleAggregateOf(row);
	}

	public async isNameTaken(name: string): Promise<boolean> {
		return (await this.db.role.count({ where: { name, ...PLATFORM_SET } })) > 0;
	}

	public async save(role: RoleAggregate): Promise<RoleState> {
		const state: RoleState = role.snapshot();
		for (const change of role.pullChanges()) {
			await this.apply(change, state);
		}
		return roleStateOf(await this.db.role.findUniqueOrThrow({ where: { id: state.id } }));
	}

	private async apply(change: RoleChange, state: RoleState): Promise<void> {
		switch (change.kind) {
			case "created":
				await this.db.role.create({
					data: {
						id: state.id,
						name: state.name,
						description: state.description,
						isSystem: false,
					},
				});
				return;
			case "revised":
				await this.db.role.update({ where: { id: state.id }, data: revisionData(change.revision, state.updatedAt) });
				return;
			case "removed":
				await this.db.role.update({ where: { id: state.id }, data: { isDeleted: true, deletedAt: state.deletedAt, updatedAt: state.updatedAt } });
				return;
			case "restored":
				await this.db.role.update({ where: { id: state.id }, data: { isDeleted: false, deletedAt: null, isActive: true, updatedAt: state.updatedAt } });
				return;
			case "permissions_synced":
				await this.syncRolePermissions(state.id, change.permissionIds, change.assignedBy, state.updatedAt);
				return;
		}
	}

	/** Revive listed rows, soft-delete the rest, insert new ones. */
	private async syncRolePermissions(roleId: string, permissionIds: readonly string[], assignedBy: string, now: number): Promise<void> {
		await this.db.rolePermission.updateMany({
			where: { roleId, isDeleted: false, permissionId: { notIn: [...permissionIds] } },
			data: { isDeleted: true, deletedAt: now, updatedAt: now },
		});
		if (permissionIds.length === 0) {
			return;
		}
		// Revive previously soft-deleted rows (the unique key makes createMany skip them).
		await this.db.rolePermission.updateMany({
			where: { roleId, permissionId: { in: [...permissionIds] }, isDeleted: true },
			data: { isDeleted: false, deletedAt: null, assignedBy, assignedAt: now, updatedAt: now },
		});
		await this.db.rolePermission.createMany({
			data: permissionIds.map((permissionId: string) => ({ roleId, permissionId, assignedBy })),
			skipDuplicates: true,
		});
	}
}
