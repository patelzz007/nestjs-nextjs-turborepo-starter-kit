import { Injectable } from "@nestjs/common";
import type { Permission, Prisma } from "@prisma/client";

import { nowEpochMs, type PaginationInput, type PermissionAction, type PermissionResource } from "@workspace/shared";

import { fetchListPage } from "../../../platform/persistence/list-page";
import type { RepositoryListResult } from "../../../platform/persistence/types";
import { PrismaService } from "../../../prisma/prisma.service";

export interface PermissionListQuery extends PaginationInput {
	readonly resource?: PermissionResource | undefined;
	readonly action?: PermissionAction | undefined;
	readonly group?: string | undefined;
}

/**
 * Fields an API caller may set when creating a permission. `isSystem` is not
 * one of them: system permissions come only from the code registry sync
 * (`PermissionMigrationService`).
 */
export interface CreatePermissionInput {
	readonly action: PermissionAction;
	readonly resource: PermissionResource;
	readonly description?: string | undefined;
	readonly group?: string | undefined;
}

/** Metadata an API caller may change on a non-system permission. */
export interface UpdatePermissionInput {
	readonly description?: string | undefined;
	readonly group?: string | undefined;
}

/** `ACTION:RESOURCE` pair of a permission row. */
export type PermissionKeyRow = Pick<Permission, "action" | "resource">;

const PERMISSION_LIST_ORDER: Prisma.PermissionOrderByWithRelationInput[] = [{ resource: "asc" }, { action: "asc" }, { id: "asc" }];

function buildListWhere(query: PermissionListQuery): Prisma.PermissionWhereInput {
	return {
		isDeleted: false,
		...(query.resource !== undefined ? { resource: query.resource } : {}),
		...(query.action !== undefined ? { action: query.action } : {}),
		...(query.group !== undefined ? { group: query.group } : {}),
	};
}

/**
 * Persistence for the `permissions` catalog. Writes take the caller's
 * transaction client (see `RbacMutationRunner`).
 */
@Injectable()
export class PermissionRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async findById(permissionId: string, db: Prisma.TransactionClient = this.prisma): Promise<Permission | null> {
		return db.permission.findFirst({ where: { id: permissionId, isDeleted: false } });
	}

	public async findDeletedById(permissionId: string, db: Prisma.TransactionClient): Promise<Permission | null> {
		return db.permission.findFirst({ where: { id: permissionId, isDeleted: true } });
	}

	/** Any row (deleted or not) for the pair — the `(action, resource, scope)` unique key covers soft-deleted rows too. */
	public async findAnyByActionResource(action: PermissionAction, resource: PermissionResource, db: Prisma.TransactionClient): Promise<Permission | null> {
		return db.permission.findFirst({ where: { action, resource, scope: "GLOBAL" } });
	}

	public async findByActionResource(action: PermissionAction, resource: PermissionResource): Promise<Permission | null> {
		return this.prisma.permission.findFirst({ where: { action, resource, isDeleted: false } });
	}

	/** `ACTION:RESOURCE` pairs of the non-deleted permissions among `permissionIds`. */
	public async findKeysByIds(permissionIds: readonly string[], db: Prisma.TransactionClient): Promise<PermissionKeyRow[]> {
		if (permissionIds.length === 0) {
			return [];
		}
		return db.permission.findMany({ where: { id: { in: [...permissionIds] }, isDeleted: false }, select: { action: true, resource: true } });
	}

	/** How many of `permissionIds` exist and are not deleted. */
	public async countExisting(permissionIds: readonly string[], db: Prisma.TransactionClient): Promise<number> {
		if (permissionIds.length === 0) {
			return 0;
		}
		return db.permission.count({ where: { id: { in: [...permissionIds] }, isDeleted: false } });
	}

	public async list(query: PermissionListQuery): Promise<RepositoryListResult<Permission>> {
		return fetchListPage(query, {
			where: buildListWhere(query),
			order: { orderBy: PERMISSION_LIST_ORDER, isDefault: true },
			and: (left: Prisma.PermissionWhereInput, right: Prisma.PermissionWhereInput): Prisma.PermissionWhereInput => ({ AND: [left, right] }),
			count: (where: Prisma.PermissionWhereInput) => this.prisma.permission.count({ where }),
			findMany: (args) => this.prisma.permission.findMany(args),
		});
	}

	public async listGroups(): Promise<string[]> {
		const rows = await this.prisma.permission.findMany({
			where: { isDeleted: false, group: { not: null } },
			select: { group: true },
			distinct: ["group"],
		});
		return rows.flatMap((row): string[] => (row.group === null || row.group.length === 0 ? [] : [row.group]));
	}

	public async create(input: CreatePermissionInput, db: Prisma.TransactionClient): Promise<Permission> {
		return db.permission.create({
			data: {
				action: input.action,
				resource: input.resource,
				description: input.description ?? null,
				group: input.group ?? null,
				isSystem: false,
			},
		});
	}

	public async update(permissionId: string, input: UpdatePermissionInput, db: Prisma.TransactionClient): Promise<Permission> {
		return db.permission.update({
			where: { id: permissionId },
			data: {
				...(input.description !== undefined ? { description: input.description } : {}),
				...(input.group !== undefined ? { group: input.group } : {}),
				updatedAt: nowEpochMs(),
			},
		});
	}

	public async softDelete(permissionId: string, db: Prisma.TransactionClient): Promise<void> {
		const now = nowEpochMs();
		await db.permission.update({ where: { id: permissionId }, data: { isDeleted: true, deletedAt: now, updatedAt: now } });
	}

	public async restore(permissionId: string, db: Prisma.TransactionClient): Promise<Permission> {
		return db.permission.update({ where: { id: permissionId }, data: { isDeleted: false, deletedAt: null, updatedAt: nowEpochMs() } });
	}
}
