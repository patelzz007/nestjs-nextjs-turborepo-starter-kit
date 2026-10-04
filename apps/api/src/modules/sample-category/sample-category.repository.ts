import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import {
	nowEpochMs,
	type CreateSampleCategoryInput,
	type SampleCategory as SampleCategoryEntity,
	type SampleCategoryListQuery,
	type SampleCategoryListSortField,
	type UpdateSampleCategoryInput,
	sampleCategoryListQuery,
} from "@workspace/shared";
import { z } from "zod";

import { BaseRepository } from "../../platform/persistence/base.repository";
import { defineKeyset, type ListKeyset } from "../../platform/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../platform/persistence/list-query/list-order";
import { fieldWhere, toPrismaComparableFilter, toPrismaNullableBooleanFilter } from "../../platform/persistence/list-query/prisma-filter";
import type { CascadeSoftDeleteMutationArgs, CascadeRestoreParentArgs } from "../../platform/persistence/cascade-soft-delete";
import { PrismaService } from "../../prisma/prisma.service";

type SampleCategoryRow = Prisma.SampleCategoryGetPayload<Prisma.SampleCategoryDefaultArgs>;

function toDomain(row: SampleCategoryRow): SampleCategoryEntity {
	return {
		id: row.id,
		description: row.description,
		isActive: row.isActive ?? true,
		name: row.name,
		slug: row.slug,
		sortOrder: row.sortOrder ?? 0,
		version: row.version,
		deletedAt: row.deletedAt === null ? null : Number(row.deletedAt),
		createdAt: Number(row.createdAt),
		updatedAt: Number(row.updatedAt),
	};
}
// ── List query → Prisma (explicit field → column mapping; see docs/technical/api/list-queries.md) ──

/** Every whitelisted sort field mapped to its column. */
export const SAMPLE_CATEGORY_SORT_COLUMNS: SortColumns<SampleCategoryListSortField, Prisma.SampleCategoryOrderByWithRelationInput> = {
	name: (direction) => ({ name: direction }),
	slug: (direction) => ({ slug: direction }),
	sortOrder: (direction) => ({ sortOrder: direction }),
	createdAt: (direction) => ({ createdAt: direction }),
};

/** Soft delete + the filter AST + search (name / slug). */
export function buildSampleCategoryListWhere(query: SampleCategoryListQuery): Prisma.SampleCategoryWhereInput {
	const filter = query.filter;
	const conditions: Prisma.SampleCategoryWhereInput[] = [
		{ deletedAt: null },
		...fieldWhere(toPrismaNullableBooleanFilter(filter?.isActive), (isActive) => ({ isActive })),
		...fieldWhere(toPrismaComparableFilter(filter?.createdAt), (createdAt) => ({ createdAt })),
		...(query.search !== undefined
			? [
					{
						OR: [{ name: { contains: query.search, mode: "insensitive" } }, { slug: { contains: query.search, mode: "insensitive" } }],
					} satisfies Prisma.SampleCategoryWhereInput,
				]
			: []),
	];
	return { AND: conditions };
}

export function buildSampleCategoryListOrder(query: SampleCategoryListQuery): ListOrder<Prisma.SampleCategoryOrderByWithRelationInput> {
	return buildListOrder(sampleCategoryListQuery.resolveSort(query.sort), {
		columns: SAMPLE_CATEGORY_SORT_COLUMNS,
		tieBreaker: (direction) => ({ id: direction }),
	});
}

/** Keyset for the default order (`createdAt desc, id desc`). */
export const SAMPLE_CATEGORY_LIST_KEYSET: ListKeyset<SampleCategoryRow, Prisma.SampleCategoryWhereInput> = defineKeyset({
	position: z.object({ createdAt: z.number().int().nonnegative(), id: z.uuid() }).strict(),
	read: (row: SampleCategoryRow) => ({ createdAt: Number(row.createdAt), id: row.id }),
	after: (position): Prisma.SampleCategoryWhereInput => ({
		OR: [{ createdAt: { lt: position.createdAt } }, { createdAt: position.createdAt, id: { lt: position.id } }],
	}),
});

// Optional DTO fields the caller did not supply are omitted (never passed as
// `undefined`): Prisma then applies the column default on create and leaves the
// column untouched on update. An explicit `null` description clears it.
function toCreateInput(input: CreateSampleCategoryInput): Prisma.SampleCategoryCreateInput {
	return {
		name: input.name,
		slug: input.slug,
		...(input.description === undefined ? {} : { description: input.description }),
		...(input.isActive === undefined ? {} : { isActive: input.isActive }),
		...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
	};
}

/** `version` is the optimistic-lock token — it goes into the update's `where`, never its data. */
function toUpdateInput(input: UpdateSampleCategoryInput): Prisma.SampleCategoryUpdateManyMutationInput {
	return {
		...(input.name === undefined ? {} : { name: input.name }),
		...(input.slug === undefined ? {} : { slug: input.slug }),
		...(input.description === undefined ? {} : { description: input.description }),
		...(input.isActive === undefined ? {} : { isActive: input.isActive }),
		...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
	};
}

const SampleCategoryRepositoryPorts = {
	toDomain,
	toCreateInput,
	toUpdateInput,
	buildListWhere: buildSampleCategoryListWhere,
	buildListOrder: buildSampleCategoryListOrder,
	listKeyset: SAMPLE_CATEGORY_LIST_KEYSET,
	andWhere: (left: Prisma.SampleCategoryWhereInput, right: Prisma.SampleCategoryWhereInput): Prisma.SampleCategoryWhereInput => ({ AND: [left, right] }),
	buildFindByIdWhere: (id: string): Prisma.SampleCategoryWhereInput => ({ id, deletedAt: null }),
	buildFindByIdIncludingDeletedWhere: (id: string): Prisma.SampleCategoryWhereInput => ({ id }),
	readDeletedAt: (row: Prisma.SampleCategoryGetPayload<Prisma.SampleCategoryDefaultArgs>): number | null => (row.deletedAt === null ? null : Number(row.deletedAt)),
	buildLiveWhere: (id: string): Prisma.SampleCategoryWhereInput => ({ id, deletedAt: null }),
	buildUniqueWhere: (id: string): Prisma.SampleCategoryWhereUniqueInput => ({ id }),
	// Optimistic locking: the update applies only to the live row still at the version the client read.
	buildUpdateWhere: (id: string, input: UpdateSampleCategoryInput): Prisma.SampleCategoryWhereInput => ({ id, deletedAt: null, version: input.version }),
	stampUpdate: (data: Prisma.SampleCategoryUpdateManyMutationInput): Prisma.SampleCategoryUpdateManyMutationInput => ({
		...data,
		version: { increment: 1 },
		updatedAt: nowEpochMs(),
	}),
	stampSoftDelete: (): Prisma.SampleCategoryUpdateManyMutationInput => ({ deletedAt: nowEpochMs(), updatedAt: nowEpochMs() }),
	stampRestore: (): Prisma.SampleCategoryUpdateManyMutationInput => ({ deletedAt: null, updatedAt: nowEpochMs() }),
	cascadeSoftDelete: {
		softDeleteChildren: async ({ parentId, deletedAt, transaction }: CascadeSoftDeleteMutationArgs): Promise<void> => {
			await transaction.product.updateMany({
				where: { categoryId: parentId, deletedAt: null },
				data: { deletedAt, updatedAt: deletedAt },
			});
		},
		restoreChildren: async ({ parentId, deletedAt, transaction }: CascadeSoftDeleteMutationArgs): Promise<void> => {
			await transaction.product.updateMany({
				where: { categoryId: parentId, deletedAt },
				data: { deletedAt: null, updatedAt: nowEpochMs() },
			});
		},
		softDeleteParent: async ({ parentId, deletedAt, transaction }: CascadeSoftDeleteMutationArgs): Promise<number> => {
			const result = await transaction.sampleCategory.updateMany({
				where: { id: parentId, deletedAt: null },
				data: { deletedAt, updatedAt: deletedAt },
			});
			return result.count;
		},
		restoreParent: async ({ parentId, transaction }: CascadeRestoreParentArgs): Promise<void> => {
			await transaction.sampleCategory.update({
				where: { id: parentId },
				data: { deletedAt: null, updatedAt: nowEpochMs() },
			});
		},
	},
};

@Injectable()
export class SampleCategoryRepository extends BaseRepository<
	SampleCategoryEntity,
	CreateSampleCategoryInput,
	UpdateSampleCategoryInput,
	SampleCategoryListQuery,
	Prisma.SampleCategoryGetPayload<Prisma.SampleCategoryDefaultArgs>,
	Prisma.SampleCategoryWhereInput,
	Prisma.SampleCategoryOrderByWithRelationInput,
	Prisma.SampleCategoryCreateInput,
	Prisma.SampleCategoryUpdateManyMutationInput,
	Prisma.SampleCategoryWhereUniqueInput
> {
	public constructor(prisma: PrismaService) {
		super(prisma, SampleCategoryRepositoryPorts, (db: Prisma.TransactionClient) => db.sampleCategory, { softDelete: true });
	}
}
