import { Injectable } from "@nestjs/common";
import type { Permission, Prisma } from "@prisma/client";
import { PermissionResource as PrismaPermissionResource } from "@prisma/client";

import { nowEpochMs, type PaginationInput, type PermissionAction, type PermissionResource } from "@workspace/shared";

import { BaseRepository } from "../../../platform/persistence/base.repository";
import { PrismaService } from "../../../prisma/prisma.service";

import type { CreatePermissionInput, UpdatePermissionInput } from "../services/permission.service";

export interface PermissionListQuery extends PaginationInput {
	readonly resource?: PermissionResource;
	readonly action?: PermissionAction;
	readonly group?: string;
}

function toPrismaResource(resource: PermissionResource): PrismaPermissionResource {
	return resource;
}

function toDomain(row: Permission): Permission {
	return row;
}

function toCreateInput(input: CreatePermissionInput): Prisma.PermissionCreateInput {
	return {
		action: input.action,
		resource: toPrismaResource(input.resource),
		description: input.description ?? null,
		group: input.group ?? null,
		isSystem: input.isSystem ?? false,
	};
}

function toUpdateInput(input: UpdatePermissionInput): Prisma.PermissionUpdateInput {
	const data: Prisma.PermissionUpdateInput = {};
	if (input.description !== undefined) {
		data.description = input.description;
	}
	if (input.group !== undefined) {
		data.group = input.group;
	}
	if (input.isSystem !== undefined) {
		data.isSystem = input.isSystem;
	}
	return data;
}

function buildListWhere(query: PermissionListQuery): Prisma.PermissionWhereInput {
	return {
		isDeleted: false,
		...(query.resource !== undefined ? { resource: toPrismaResource(query.resource) } : {}),
		...(query.action !== undefined ? { action: query.action } : {}),
		...(query.group !== undefined ? { group: query.group } : {}),
	};
}

const PermissionRepositoryPorts = {
	toDomain,
	toCreateInput,
	toUpdateInput,
	buildListWhere,
	buildListOrderBy: (): Prisma.PermissionOrderByWithRelationInput[] => [{ resource: "asc" }, { action: "asc" }],
	buildFindByIdWhere: (id: string): Prisma.PermissionWhereInput => ({ id, isDeleted: false }),
	buildUpdateWhere: (id: string): Prisma.PermissionWhereUniqueInput => ({ id }),
	stampUpdate: (data: Prisma.PermissionUpdateInput): Prisma.PermissionUpdateInput => ({ ...data, updatedAt: nowEpochMs() }),
	stampSoftDelete: (): Prisma.PermissionUpdateInput => ({ isDeleted: true, deletedAt: nowEpochMs(), updatedAt: nowEpochMs() }),
	stampRestore: (): Prisma.PermissionUpdateInput => ({ isDeleted: false, deletedAt: null, updatedAt: nowEpochMs() }),
};

@Injectable()
export class PermissionRepository extends BaseRepository<
	Permission,
	CreatePermissionInput,
	UpdatePermissionInput,
	PermissionListQuery,
	Permission,
	Prisma.PermissionWhereInput,
	Prisma.PermissionOrderByWithRelationInput[],
	Prisma.PermissionCreateInput,
	Prisma.PermissionUpdateInput,
	Prisma.PermissionWhereUniqueInput
> {
	public constructor(prisma: PrismaService) {
		super(prisma, PermissionRepositoryPorts, prisma.permission, { softDelete: true, concurrency: false });
	}

	public async findByActionResource(action: PermissionAction, resource: PermissionResource): Promise<Permission | null> {
		return this.prisma.permission.findFirst({
			where: { action, resource: toPrismaResource(resource), isDeleted: false },
		});
	}

	public async findDeletedById(permissionId: string): Promise<Permission | null> {
		return this.prisma.permission.findFirst({
			where: { id: permissionId, isDeleted: true },
		});
	}

	public async listGroups(): Promise<string[]> {
		const result = await this.prisma.permission.findMany({
			where: { isDeleted: false, group: { not: null } },
			select: { group: true },
			distinct: ["group"],
		});
		return result.map((row) => row.group ?? "").filter((group) => group.length > 0);
	}
}
