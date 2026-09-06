import { Injectable } from "@nestjs/common";
import type { Prisma, Role } from "@prisma/client";

import { nowEpochMs, type PaginationInput } from "@workspace/shared";

import { BaseRepository } from "../../../platform/persistence/base.repository";
import { PrismaService } from "../../../prisma/prisma.service";

import type { CreateRoleInput, UpdateRoleInput } from "../services/role.service";

function toDomain(row: Role): Role {
	return row;
}

function toCreateInput(input: CreateRoleInput): Prisma.RoleCreateInput {
	return {
		name: input.name,
		description: input.description ?? null,
		...(input.parentId !== undefined ? { parent: { connect: { id: input.parentId } } } : {}),
	};
}

function toUpdateInput(input: UpdateRoleInput): Prisma.RoleUpdateInput {
	const data: Prisma.RoleUpdateInput = {};
	if (input.name !== undefined) {
		data.name = input.name;
	}
	if (input.description !== undefined) {
		data.description = input.description;
	}
	if (input.isActive !== undefined) {
		data.isActive = input.isActive;
	}
	return data;
}

const RoleRepositoryPorts = {
	toDomain,
	toCreateInput,
	toUpdateInput,
	buildListWhere: (): Prisma.RoleWhereInput => ({ isDeleted: false }),
	buildListOrderBy: (): Prisma.RoleOrderByWithRelationInput => ({ name: "asc" }),
	buildFindByIdWhere: (id: string): Prisma.RoleWhereInput => ({ id, isDeleted: false }),
	buildUpdateWhere: (id: string): Prisma.RoleWhereUniqueInput => ({ id }),
	stampUpdate: (data: Prisma.RoleUpdateInput): Prisma.RoleUpdateInput => ({ ...data, updatedAt: nowEpochMs() }),
	stampSoftDelete: (): Prisma.RoleUpdateInput => ({ isDeleted: true, deletedAt: nowEpochMs(), updatedAt: nowEpochMs() }),
	stampRestore: (): Prisma.RoleUpdateInput => ({ isDeleted: false, deletedAt: null, isActive: true, updatedAt: nowEpochMs() }),
};

@Injectable()
export class RoleRepository extends BaseRepository<
	Role,
	CreateRoleInput,
	UpdateRoleInput,
	PaginationInput,
	Role,
	Prisma.RoleWhereInput,
	Prisma.RoleOrderByWithRelationInput,
	Prisma.RoleCreateInput,
	Prisma.RoleUpdateInput,
	Prisma.RoleWhereUniqueInput
> {
	public constructor(prisma: PrismaService) {
		super(prisma, RoleRepositoryPorts, prisma.role, { softDelete: true, concurrency: false });
	}

	public async findByName(name: string): Promise<Role | null> {
		return this.prisma.role.findFirst({
			where: { name, isDeleted: false },
		});
	}

	public async findByNames(names: readonly string[]): Promise<Role[]> {
		if (names.length === 0) {
			return [];
		}
		return this.prisma.role.findMany({
			where: { name: { in: [...names] }, isDeleted: false },
		});
	}

	public async findDeletedById(roleId: string): Promise<Role | null> {
		return this.prisma.role.findFirst({
			where: { id: roleId, isDeleted: true },
		});
	}

	public async findAncestorsWithParent(roleId: string): Promise<readonly Pick<Role, "parentId">[]> {
		return this.prisma.role.findMany({
			where: { id: roleId, isDeleted: false, parentId: { not: null } },
			select: { parentId: true },
		});
	}

	public async setParent(roleId: string, parentId: string | null): Promise<Role> {
		return this.prisma.role.update({
			where: { id: roleId },
			data: { parentId, updatedAt: nowEpochMs() },
		});
	}
}
