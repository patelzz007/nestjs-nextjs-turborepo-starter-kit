import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import {
	nowEpochMs,
	type CreateSampleCategoryInput,
	type SampleCategory as SampleCategoryEntity,
	type SampleCategoryListQuery,
	type UpdateSampleCategoryInput,
} from "@workspace/shared";

import { BaseRepository } from "../../platform/persistence/base.repository";
import { PrismaService } from "../../prisma/prisma.service";

function toDomain(row: Prisma.SampleCategoryGetPayload<Record<string, never>>): SampleCategoryEntity {
	return {
		id: row.id,
		description: row.description,
		isActive: row.isActive ?? true,
		name: row.name,
		slug: row.slug,
		sortOrder: row.sortOrder ?? 0,
		deletedAt: row.deletedAt === null ? null : Number(row.deletedAt),
		createdAt: Number(row.createdAt),
		updatedAt: Number(row.updatedAt),
	};
}
const SORTABLE_FIELDS: ReadonlySet<string> = new Set(["name", "slug", "sortOrder", "createdAt"]);

function buildSearchConditions(trimmedSearch: string): Prisma.SampleCategoryWhereInput[] {
	return [{ name: { contains: trimmedSearch, mode: "insensitive" } }, { slug: { contains: trimmedSearch, mode: "insensitive" } }];
}

function resolveOrderBy(query: SampleCategoryListQuery): Prisma.SampleCategoryOrderByWithRelationInput {
	const sortBy = query.sortBy ?? "createdAt";
	const sortDirection = query.sortDirection ?? "desc";
	if (!SORTABLE_FIELDS.has(sortBy)) {
		return { createdAt: "desc" };
	}
	return { [sortBy]: sortDirection };
}

function buildListWhere(query: SampleCategoryListQuery): Prisma.SampleCategoryWhereInput {
	const where: Prisma.SampleCategoryWhereInput = {
		deletedAt: null,
	};
	const trimmedSearch = query.search?.trim();
	if (trimmedSearch !== undefined && trimmedSearch.length > 0) {
		const searchConditions = buildSearchConditions(trimmedSearch);
		if (searchConditions.length > 0) {
			where.OR = searchConditions;
		}
	}
	return where;
}

const SampleCategoryRepositoryPorts = {
	toDomain,
	toCreateInput: (input: CreateSampleCategoryInput): Prisma.SampleCategoryCreateInput => input,
	toUpdateInput: (input: UpdateSampleCategoryInput): Prisma.SampleCategoryUpdateInput => input,
	buildListWhere,
	buildListOrderBy: resolveOrderBy,
	buildFindByIdWhere: (id: string): Prisma.SampleCategoryWhereInput => ({ id, deletedAt: null }),
	buildUpdateWhere: (id: string): Prisma.SampleCategoryWhereUniqueInput => ({ id }),
	stampUpdate: (data: Prisma.SampleCategoryUpdateInput): Prisma.SampleCategoryUpdateInput => ({ ...data, updatedAt: nowEpochMs() }),
	stampSoftDelete: (): Prisma.SampleCategoryUpdateInput => ({ deletedAt: nowEpochMs(), updatedAt: nowEpochMs() }),
	stampRestore: (): Prisma.SampleCategoryUpdateInput => ({ deletedAt: null, updatedAt: nowEpochMs() }),
};

@Injectable()
export class GeneratedSampleCategoryRepository extends BaseRepository<
	SampleCategoryEntity,
	CreateSampleCategoryInput,
	UpdateSampleCategoryInput,
	SampleCategoryListQuery,
	Prisma.SampleCategoryGetPayload<Record<string, never>>,
	Prisma.SampleCategoryWhereInput,
	Prisma.SampleCategoryOrderByWithRelationInput,
	Prisma.SampleCategoryCreateInput,
	Prisma.SampleCategoryUpdateInput,
	Prisma.SampleCategoryWhereUniqueInput
> {
	public constructor(prisma: PrismaService) {
		super(prisma, SampleCategoryRepositoryPorts, prisma.sampleCategory, { softDelete: true, concurrency: false });
	}
}
