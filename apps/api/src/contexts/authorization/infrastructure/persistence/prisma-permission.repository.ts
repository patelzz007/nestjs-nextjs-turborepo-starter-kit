import type { Permission, Prisma } from "@prisma/client";
import { PermissionActionSchema, PermissionResourceSchema } from "@workspace/shared";

import type { PermissionAggregate, PermissionChange, PermissionState } from "../../domain/aggregates/permission.aggregate";
import type { RbacPermissionPair } from "../../domain/policies/rbac-escalation.policy";
import type { PermissionRepository } from "../../domain/repositories/permission.repository";
import { permissionAggregateOf, permissionStateOf } from "./rbac-row.mapper";

/** The `Permission` catalog on the RBAC transaction. Never creates a system permission from caller input. */
export class PrismaPermissionRepository implements PermissionRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async findLive(permissionId: string): Promise<PermissionAggregate | null> {
		const row: Permission | null = await this.db.permission.findFirst({ where: { id: permissionId, isDeleted: false } });
		return row === null ? null : permissionAggregateOf(row);
	}

	public async findIncludingDeleted(permissionId: string): Promise<PermissionAggregate | null> {
		const row: Permission | null = await this.db.permission.findFirst({ where: { id: permissionId } });
		return row === null ? null : permissionAggregateOf(row);
	}

	public async existsForPair(pair: RbacPermissionPair): Promise<boolean> {
		const action = PermissionActionSchema.safeParse(pair.action);
		const resource = PermissionResourceSchema.safeParse(pair.resource);
		if (!action.success || !resource.success) {
			return false;
		}
		return (await this.db.permission.count({ where: { action: action.data, resource: resource.data, scope: "GLOBAL" } })) > 0;
	}

	public async countLive(permissionIds: readonly string[]): Promise<number> {
		if (permissionIds.length === 0) {
			return 0;
		}
		return this.db.permission.count({ where: { id: { in: [...permissionIds] }, isDeleted: false } });
	}

	public async findLivePairs(permissionIds: readonly string[]): Promise<RbacPermissionPair[]> {
		if (permissionIds.length === 0) {
			return [];
		}
		return this.db.permission.findMany({ where: { id: { in: [...permissionIds] }, isDeleted: false }, select: { action: true, resource: true } });
	}

	public async save(permission: PermissionAggregate): Promise<PermissionState> {
		const state: PermissionState = permission.snapshot();
		for (const change of permission.pullChanges()) {
			await this.apply(change, state);
		}
		return permissionStateOf(await this.db.permission.findUniqueOrThrow({ where: { id: state.id } }));
	}

	private async apply(change: PermissionChange, state: PermissionState): Promise<void> {
		switch (change.kind) {
			case "created":
				await this.db.permission.create({
					data: { id: state.id, action: state.action, resource: state.resource, description: state.description, group: state.group, isSystem: false },
				});
				return;
			case "revised":
				await this.db.permission.update({
					where: { id: state.id },
					data: {
						...(change.revision.description === undefined ? {} : { description: change.revision.description }),
						...(change.revision.group === undefined ? {} : { group: change.revision.group }),
						updatedAt: state.updatedAt,
					},
				});
				return;
			case "removed":
				await this.db.permission.update({ where: { id: state.id }, data: { isDeleted: true, deletedAt: state.deletedAt, updatedAt: state.updatedAt } });
				return;
			case "restored":
				await this.db.permission.update({ where: { id: state.id }, data: { isDeleted: false, deletedAt: null, updatedAt: state.updatedAt } });
				return;
		}
	}
}
