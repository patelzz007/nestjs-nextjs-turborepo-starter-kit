import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import {
	nowEpochMs,
	productListQuery,
	type CreateProductInput,
	type Product as ProductEntity,
	type ProductListQuery,
	type ProductListSortField,
	type UpdateProductInput,
} from "@workspace/shared";
import { z } from "zod";

import { BaseRepository } from "../../platform/persistence/base.repository";
import { defineKeyset, type ListKeyset } from "../../platform/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../platform/persistence/list-query/list-order";
import {
	fieldWhere,
	toPrismaComparableFilter,
	toPrismaEqualityFilter,
	toPrismaNullableBooleanFilter,
	toPrismaNullableComparableFilter,
	toPrismaNullableStringFilter,
} from "../../platform/persistence/list-query/prisma-filter";
import { PrismaService } from "../../prisma/prisma.service";

type ProductRow = Prisma.ProductGetPayload<Prisma.ProductDefaultArgs>;

function toDomain(row: ProductRow): ProductEntity {
	return {
		id: row.id,
		brand: row.brand,
		categoryId: row.categoryId,
		compareAtPrice: row.compareAtPrice === null ? null : Number(row.compareAtPrice),
		description: row.description,
		imageUrl: row.imageUrl,
		isActive: row.isActive ?? true,
		isFeatured: row.isFeatured ?? false,
		name: row.name,
		price: Number(row.price),
		shortDescription: row.shortDescription,
		sku: row.sku,
		slug: row.slug,
		stockQuantity: row.stockQuantity ?? 0,
		weightGrams: row.weightGrams,
		version: row.version,
		deletedAt: row.deletedAt === null ? null : Number(row.deletedAt),
		createdAt: Number(row.createdAt),
		updatedAt: Number(row.updatedAt),
	};
}

function toPrismaCreateInput(input: CreateProductInput): Prisma.ProductCreateInput {
	return {
		...(input.brand === undefined ? {} : { brand: input.brand }),
		category: { connect: { id: input.categoryId } },
		...(input.compareAtPrice === undefined ? {} : { compareAtPrice: input.compareAtPrice }),
		...(input.description === undefined ? {} : { description: input.description }),
		...(input.imageUrl === undefined ? {} : { imageUrl: input.imageUrl }),
		...(input.isActive === undefined ? {} : { isActive: input.isActive }),
		...(input.isFeatured === undefined ? {} : { isFeatured: input.isFeatured }),
		name: input.name,
		price: input.price,
		...(input.shortDescription === undefined ? {} : { shortDescription: input.shortDescription }),
		sku: input.sku,
		slug: input.slug,
		...(input.stockQuantity === undefined ? {} : { stockQuantity: input.stockQuantity }),
		...(input.weightGrams === undefined ? {} : { weightGrams: input.weightGrams }),
	};
}

function toPrismaUpdateInput(input: UpdateProductInput): Prisma.ProductUpdateInput {
	const data: Prisma.ProductUpdateInput = {};
	if (input.brand !== undefined) {
		data.brand = input.brand;
	}
	if (input.categoryId !== undefined) {
		data.category = { connect: { id: input.categoryId } };
	}
	if (input.compareAtPrice !== undefined) {
		data.compareAtPrice = input.compareAtPrice;
	}
	if (input.description !== undefined) {
		data.description = input.description;
	}
	if (input.imageUrl !== undefined) {
		data.imageUrl = input.imageUrl;
	}
	if (input.isActive !== undefined) {
		data.isActive = input.isActive;
	}
	if (input.isFeatured !== undefined) {
		data.isFeatured = input.isFeatured;
	}
	if (input.name !== undefined) {
		data.name = input.name;
	}
	if (input.price !== undefined) {
		data.price = input.price;
	}
	if (input.shortDescription !== undefined) {
		data.shortDescription = input.shortDescription;
	}
	if (input.sku !== undefined) {
		data.sku = input.sku;
	}
	if (input.slug !== undefined) {
		data.slug = input.slug;
	}
	if (input.stockQuantity !== undefined) {
		data.stockQuantity = input.stockQuantity;
	}
	if (input.weightGrams !== undefined) {
		data.weightGrams = input.weightGrams;
	}
	return data;
}
// ── List query → Prisma (explicit field → column mapping; see docs/list-queries.md) ──

/** Every whitelisted sort field mapped to its column. */
export const PRODUCT_SORT_COLUMNS: SortColumns<ProductListSortField, Prisma.ProductOrderByWithRelationInput> = {
	name: (direction) => ({ name: direction }),
	price: (direction) => ({ price: direction }),
	compareAtPrice: (direction) => ({ compareAtPrice: direction }),
	sku: (direction) => ({ sku: direction }),
	slug: (direction) => ({ slug: direction }),
	stockQuantity: (direction) => ({ stockQuantity: direction }),
	createdAt: (direction) => ({ createdAt: direction }),
};

function buildSearchWhere(search: string): Prisma.ProductWhereInput {
	return {
		OR: [
			{ brand: { contains: search, mode: "insensitive" } },
			{ name: { contains: search, mode: "insensitive" } },
			{ sku: { contains: search, mode: "insensitive" } },
			{ slug: { contains: search, mode: "insensitive" } },
		],
	};
}

/** Soft delete + the filter AST + search, one explicit column per whitelisted field. */
export function buildProductListWhere(query: ProductListQuery): Prisma.ProductWhereInput {
	const filter = query.filter;
	const conditions: Prisma.ProductWhereInput[] = [
		{ deletedAt: null },
		...fieldWhere(toPrismaNullableBooleanFilter(filter?.isActive), (isActive) => ({ isActive })),
		...fieldWhere(toPrismaNullableBooleanFilter(filter?.isFeatured), (isFeatured) => ({ isFeatured })),
		...fieldWhere(toPrismaEqualityFilter(filter?.categoryId), (categoryId) => ({ categoryId })),
		...fieldWhere(toPrismaNullableStringFilter(filter?.brand), (brand) => ({ brand })),
		...fieldWhere(toPrismaComparableFilter(filter?.price), (price) => ({ price })),
		...fieldWhere(toPrismaNullableComparableFilter(filter?.stockQuantity), (stockQuantity) => ({ stockQuantity })),
		...fieldWhere(toPrismaComparableFilter(filter?.createdAt), (createdAt) => ({ createdAt })),
		...(query.search !== undefined ? [buildSearchWhere(query.search)] : []),
	];
	return { AND: conditions };
}

export function buildProductListOrder(query: ProductListQuery): ListOrder<Prisma.ProductOrderByWithRelationInput> {
	return buildListOrder(productListQuery.resolveSort(query.sort), {
		columns: PRODUCT_SORT_COLUMNS,
		tieBreaker: (direction) => ({ id: direction }),
	});
}

/** Keyset for the default order (`createdAt desc, id desc`). */
export const PRODUCT_LIST_KEYSET: ListKeyset<ProductRow, Prisma.ProductWhereInput> = defineKeyset({
	position: z.object({ createdAt: z.number().int().nonnegative(), id: z.uuid() }).strict(),
	read: (row: ProductRow) => ({ createdAt: Number(row.createdAt), id: row.id }),
	after: (position): Prisma.ProductWhereInput => ({
		OR: [{ createdAt: { lt: position.createdAt } }, { createdAt: position.createdAt, id: { lt: position.id } }],
	}),
});

const ProductRepositoryPorts = {
	toDomain,
	toCreateInput: toPrismaCreateInput,
	toUpdateInput: toPrismaUpdateInput,
	buildListWhere: buildProductListWhere,
	buildListOrder: buildProductListOrder,
	listKeyset: PRODUCT_LIST_KEYSET,
	andWhere: (left: Prisma.ProductWhereInput, right: Prisma.ProductWhereInput): Prisma.ProductWhereInput => ({ AND: [left, right] }),
	buildFindByIdWhere: (id: string): Prisma.ProductWhereInput => ({ id, deletedAt: null }),
	buildFindByIdIncludingDeletedWhere: (id: string): Prisma.ProductWhereInput => ({ id }),
	readDeletedAt: (row: Prisma.ProductGetPayload<Prisma.ProductDefaultArgs>): number | null => (row.deletedAt === null ? null : Number(row.deletedAt)),
	buildUpdateWhere: (id: string, expectedVersion?: number): Prisma.ProductWhereUniqueInput => ({ id, ...(expectedVersion === undefined ? {} : { version: expectedVersion }) }),
	stampUpdate: (data: Prisma.ProductUpdateInput): Prisma.ProductUpdateInput => ({ ...data, version: { increment: 1 }, updatedAt: nowEpochMs() }),
	stampSoftDelete: (): Prisma.ProductUpdateInput => ({ deletedAt: nowEpochMs(), updatedAt: nowEpochMs() }),
	stampRestore: (): Prisma.ProductUpdateInput => ({ deletedAt: null, updatedAt: nowEpochMs() }),
};

@Injectable()
export class ProductRepository extends BaseRepository<
	ProductEntity,
	CreateProductInput,
	UpdateProductInput,
	ProductListQuery,
	Prisma.ProductGetPayload<Prisma.ProductDefaultArgs>,
	Prisma.ProductWhereInput,
	Prisma.ProductOrderByWithRelationInput,
	Prisma.ProductCreateInput,
	Prisma.ProductUpdateInput,
	Prisma.ProductWhereUniqueInput
> {
	public constructor(prisma: PrismaService) {
		super(prisma, ProductRepositoryPorts, prisma.product, { softDelete: true, concurrency: true });
	}
}
