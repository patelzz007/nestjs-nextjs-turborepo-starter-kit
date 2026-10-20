import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
	permissionListQuery,
	roleListQuery,
	type AdminPermissionResponse,
	type PaginatedServiceResult,
	type PermissionListItem,
	type PermissionListQuery,
	type PermissionListSortField,
	type RoleListItem,
	type RoleListQuery,
	type RoleListSortField,
	type RoleResponse,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { fetchListPage, mapListResult, toPaginatedServiceResult } from "../../../../platform/infrastructure/persistence/list-page";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../../platform/infrastructure/persistence/list-query/list-order";
import {
	fieldWhere,
	toPrismaBooleanFilter,
	toPrismaEqualityFilter,
	toPrismaNullableStringFilter,
} from "../../../../platform/infrastructure/persistence/list-query/prisma-filter";
import { PrismaReadExecutor } from "../../../../platform/infrastructure/unit-of-work/prisma-read-executor";
import { RBAC_CATALOG_READ_OPERATION } from "../../application/ports/authorization.tokens";
import type { RbacCatalogReadPort } from "../../application/ports/rbac-read.port";
import { toAdminPermissionResponse, toRoleResponse } from "../../application/services/rbac-response.mapper";
import { permissionStateOf, roleStateOf } from "../persistence/rbac-row.mapper";

const PERMISSION_SORT_COLUMNS: SortColumns<PermissionListSortField, Prisma.PermissionOrderByWithRelationInput> = {
	group: (direction) => ({ group: { sort: direction, nulls: "last" } }),
	resource: (direction) => ({ resource: direction }),
	action: (direction) => ({ action: direction }),
	createdAt: (direction) => ({ createdAt: direction }),
};

const ROLE_SORT_COLUMNS: SortColumns<RoleListSortField, Prisma.RoleOrderByWithRelationInput> = {
	name: (direction) => ({ name: direction }),
	createdAt: (direction) => ({ createdAt: direction }),
};

function permissionDescriptionMatches(search: string): Prisma.PermissionWhereInput {
	return { description: { contains: search, mode: "insensitive" } };
}

function roleNameMatches(search: string): Prisma.RoleWhereInput {
	return { name: { contains: search, mode: "insensitive" } };
}

/** Live permissions narrowed by the group / resource filters and the description search. */
export function buildPermissionListWhere(query: PermissionListQuery): Prisma.PermissionWhereInput {
	return {
		AND: [
			{ isDeleted: false },
			...fieldWhere(toPrismaNullableStringFilter(query.filter?.group), (group) => ({ group })),
			...fieldWhere(toPrismaEqualityFilter(query.filter?.resource), (resource) => ({ resource })),
			...(query.search === undefined ? [] : [permissionDescriptionMatches(query.search)]),
		],
	};
}

export function buildPermissionListOrder(query: PermissionListQuery): ListOrder<Prisma.PermissionOrderByWithRelationInput> {
	return buildListOrder(permissionListQuery.resolveSort(query.sort), { columns: PERMISSION_SORT_COLUMNS, tieBreaker: (direction) => ({ id: direction }) });
}

/** Live roles narrowed by `isActive` and the name search. */
export function buildRoleListWhere(query: RoleListQuery): Prisma.RoleWhereInput {
	return {
		AND: [
			{ isDeleted: false },
			...fieldWhere(toPrismaBooleanFilter(query.filter?.isActive), (isActive) => ({ isActive })),
			...(query.search === undefined ? [] : [roleNameMatches(query.search)]),
		],
	};
}

export function buildRoleListOrder(query: RoleListQuery): ListOrder<Prisma.RoleOrderByWithRelationInput> {
	return buildListOrder(roleListQuery.resolveSort(query.sort), { columns: ROLE_SORT_COLUMNS, tieBreaker: (direction) => ({ id: direction }) });
}

/** Catalog reads as `authorization.rbac.catalog.read` (Role and Permission only). One statement per list (no per-row reads). */
@Injectable()
export class PrismaRbacCatalogReader implements RbacCatalogReadPort {
	public constructor(private readonly reads: PrismaReadExecutor<Prisma.TransactionClient>) {}

	public async listPermissions(actor: ActorContext, query: PermissionListQuery): Promise<PaginatedServiceResult<PermissionListItem>> {
		// Offset pages only: the default order (group, resource, action) is not a keyset a cursor can continue.
		const page = await this.reads.readAsSystemOperation(RBAC_CATALOG_READ_OPERATION, actor, (db) =>
			fetchListPage(query, {
				where: buildPermissionListWhere(query),
				order: buildPermissionListOrder(query),
				and: (left, right) => ({ AND: [left, right] }),
				count: (where) => db.permission.count({ where }),
				findMany: (args) => db.permission.findMany(args),
			}),
		);
		return toPaginatedServiceResult(
			mapListResult(page, (row): PermissionListItem => ({
				id: row.id,
				action: row.action,
				resource: row.resource,
				description: row.description,
				group: row.group,
				isSystem: row.isSystem,
			})),
			query,
		);
	}

	public async findPermission(actor: ActorContext, permissionId: string): Promise<AdminPermissionResponse | null> {
		const row = await this.reads.readAsSystemOperation(RBAC_CATALOG_READ_OPERATION, actor, (db) => db.permission.findFirst({ where: { id: permissionId, isDeleted: false } }));
		return row === null ? null : toAdminPermissionResponse(permissionStateOf(row));
	}

	public async listPermissionGroups(actor: ActorContext): Promise<string[]> {
		const rows = await this.reads.readAsSystemOperation(RBAC_CATALOG_READ_OPERATION, actor, (db) =>
			db.permission.findMany({ where: { isDeleted: false, group: { not: null } }, select: { group: true }, distinct: ["group"] }),
		);
		return rows.flatMap((row): string[] => (row.group === null || row.group.length === 0 ? [] : [row.group]));
	}

	public async listRoles(actor: ActorContext, query: RoleListQuery): Promise<PaginatedServiceResult<RoleListItem>> {
		// Offset pages only: the default order (by name) is not a keyset a cursor can continue.
		const page = await this.reads.readAsSystemOperation(RBAC_CATALOG_READ_OPERATION, actor, (db) =>
			fetchListPage(query, {
				where: buildRoleListWhere(query),
				order: buildRoleListOrder(query),
				and: (left, right) => ({ AND: [left, right] }),
				count: (where) => db.role.count({ where }),
				findMany: (args) => db.role.findMany(args),
			}),
		);
		return toPaginatedServiceResult(
			mapListResult(page, (row): RoleListItem => ({ id: row.id, name: row.name, description: row.description, isActive: row.isActive, parentId: row.parentId })),
			query,
		);
	}

	public async findRole(actor: ActorContext, roleId: string): Promise<RoleResponse | null> {
		const row = await this.reads.readAsSystemOperation(RBAC_CATALOG_READ_OPERATION, actor, (db) => db.role.findFirst({ where: { id: roleId, isDeleted: false } }));
		return row === null ? null : toRoleResponse(roleStateOf(row));
	}
}
