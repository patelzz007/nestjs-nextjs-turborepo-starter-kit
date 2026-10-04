import { Injectable } from "@nestjs/common";
import type { Prisma, Role } from "@prisma/client";

import { nowEpochMs, type PaginationInput } from "@workspace/shared";

import { fetchListPage } from "../../../platform/persistence/list-page";
import type { RepositoryListResult } from "../../../platform/persistence/types";
import { PrismaService } from "../../../prisma/prisma.service";

/** Fields an API caller may set when creating a role (`isSystem` is never one of them). */
export interface CreateRoleInput {
	readonly name: string;
	readonly description?: string | undefined;
	readonly parentId?: string | undefined;
}

/** Fields an API caller may change on a non-system role. */
export interface UpdateRoleInput {
	readonly name?: string | undefined;
	readonly description?: string | undefined;
	readonly isActive?: boolean | undefined;
}

/** A role's id and parent link, read regardless of its deleted / active state. */
export interface RoleParentLink {
	readonly id: string;
	readonly parentId: string | null;
}

const ROLE_LIST_ORDER: Prisma.RoleOrderByWithRelationInput[] = [{ name: "asc" }, { id: "asc" }];

function toUpdateData(input: UpdateRoleInput): Prisma.RoleUpdateInput {
	return {
		...(input.name !== undefined ? { name: input.name } : {}),
		...(input.description !== undefined ? { description: input.description } : {}),
		...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
		updatedAt: nowEpochMs(),
	};
}

/**
 * Persistence for `roles`. Every write takes the caller's transaction client:
 * RBAC writes only ever run inside `RbacMutationRunner` (one transaction with
 * the session revocation and the audit row), never on a bare connection.
 */
@Injectable()
export class RoleRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async findById(roleId: string, db: Prisma.TransactionClient = this.prisma): Promise<Role | null> {
		return db.role.findFirst({ where: { id: roleId, isDeleted: false } });
	}

	public async findByIdIncludingDeleted(roleId: string, db: Prisma.TransactionClient): Promise<Role | null> {
		return db.role.findFirst({ where: { id: roleId } });
	}

	public async findByName(name: string, db: Prisma.TransactionClient = this.prisma): Promise<Role | null> {
		return db.role.findFirst({ where: { name, isDeleted: false } });
	}

	/** `roles.name` is unique across soft-deleted rows too — used to reject a create that would collide. */
	public async findByNameIncludingDeleted(name: string, db: Prisma.TransactionClient): Promise<Role | null> {
		return db.role.findFirst({ where: { name } });
	}

	public async findByNames(names: readonly string[]): Promise<Role[]> {
		if (names.length === 0) {
			return [];
		}
		return this.prisma.role.findMany({ where: { name: { in: [...names] }, isDeleted: false } });
	}

	public async list(query: PaginationInput): Promise<RepositoryListResult<Role>> {
		const where: Prisma.RoleWhereInput = { isDeleted: false };
		return fetchListPage(query, {
			where,
			order: { orderBy: ROLE_LIST_ORDER, isDefault: true },
			and: (left: Prisma.RoleWhereInput, right: Prisma.RoleWhereInput): Prisma.RoleWhereInput => ({ AND: [left, right] }),
			count: (countWhere: Prisma.RoleWhereInput) => this.prisma.role.count({ where: countWhere }),
			findMany: (args) => this.prisma.role.findMany(args),
		});
	}

	/** Parent links of `roleIds`, whatever their deleted / active state (privilege and cycle checks must see every ancestor). */
	public async findParentLinks(roleIds: readonly string[], db: Prisma.TransactionClient): Promise<RoleParentLink[]> {
		if (roleIds.length === 0) {
			return [];
		}
		return db.role.findMany({ where: { id: { in: [...roleIds] } }, select: { id: true, parentId: true } });
	}

	/** Direct children of `roleIds`, whatever their state. */
	public async findChildIds(roleIds: readonly string[], db: Prisma.TransactionClient): Promise<string[]> {
		if (roleIds.length === 0) {
			return [];
		}
		const rows = await db.role.findMany({ where: { parentId: { in: [...roleIds] } }, select: { id: true } });
		return rows.map((row): string => row.id);
	}

	/** Active, non-deleted parent links — the hierarchy the kernel actually evaluates. */
	public async findEffectiveParentLinks(roleIds: readonly string[], db: Prisma.TransactionClient): Promise<RoleParentLink[]> {
		if (roleIds.length === 0) {
			return [];
		}
		return db.role.findMany({ where: { id: { in: [...roleIds] }, isDeleted: false, isActive: true }, select: { id: true, parentId: true } });
	}

	/** Names of active, non-deleted roles among `roleIds`. */
	public async findEffectiveNames(roleIds: readonly string[], db: Prisma.TransactionClient): Promise<Map<string, string>> {
		if (roleIds.length === 0) {
			return new Map<string, string>();
		}
		const rows = await db.role.findMany({ where: { id: { in: [...roleIds] }, isDeleted: false, isActive: true }, select: { id: true, name: true } });
		return new Map<string, string>(rows.map((row): [string, string] => [row.id, row.name]));
	}

	/** Non-deleted system roles among `names` (missing names are simply absent). */
	public async findSystemRolesByName(names: readonly string[], db: Prisma.TransactionClient): Promise<Role[]> {
		return db.role.findMany({ where: { name: { in: [...names] }, isSystem: true, isDeleted: false } });
	}

	public async create(input: CreateRoleInput, db: Prisma.TransactionClient): Promise<Role> {
		return db.role.create({
			data: {
				name: input.name,
				description: input.description ?? null,
				isSystem: false,
				...(input.parentId !== undefined ? { parent: { connect: { id: input.parentId } } } : {}),
			},
		});
	}

	public async update(roleId: string, input: UpdateRoleInput, db: Prisma.TransactionClient): Promise<Role> {
		return db.role.update({ where: { id: roleId }, data: toUpdateData(input) });
	}

	public async softDelete(roleId: string, db: Prisma.TransactionClient): Promise<void> {
		const now = nowEpochMs();
		await db.role.update({ where: { id: roleId }, data: { isDeleted: true, deletedAt: now, updatedAt: now } });
	}

	public async restore(roleId: string, db: Prisma.TransactionClient): Promise<Role> {
		return db.role.update({ where: { id: roleId }, data: { isDeleted: false, deletedAt: null, isActive: true, updatedAt: nowEpochMs() } });
	}

	public async setParent(roleId: string, parentId: string | null, db: Prisma.TransactionClient): Promise<Role> {
		return db.role.update({ where: { id: roleId }, data: { parentId, updatedAt: nowEpochMs() } });
	}
}
