import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { nowEpochMs, type CreateProductInput, type Product as ProductEntity, type ProductListQuery, type UpdateProductInput } from "@workspace/shared";

import { BaseRepository } from "../../platform/persistence/base.repository";
import { PrismaService } from "../../prisma/prisma.service";

function toDomain(row: Prisma.ProductGetPayload<Record<string, never>>): ProductEntity {
	return {
		id: row.id,
		brand: row.brand,
		categoryId: row.categoryId,
		compareAtPrice: row.compareAtPrice === null ? null : Number(row.compareAtPrice),
		description: row.description,
		imageUrl: row.imageUrl,
		isActive: row.isActive,
		isFeatured: row.isFeatured,
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
		brand: input.brand,
		category: { connect: { id: input.categoryId } },
		compareAtPrice: input.compareAtPrice,
		description: input.description,
		imageUrl: input.imageUrl,
		isActive: input.isActive,
		isFeatured: input.isFeatured,
		name: input.name,
		price: input.price,
		shortDescription: input.shortDescription,
		sku: input.sku,
		slug: input.slug,
		stockQuantity: input.stockQuantity,
		weightGrams: input.weightGrams,
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
const SORTABLE_FIELDS: ReadonlySet<string> = new Set(["sku", "name", "price", "stockQuantity", "createdAt"]);

function buildSearchConditions(trimmedSearch: string): Prisma.ProductWhereInput[] {
	return [
		{ sku: { contains: trimmedSearch, mode: "insensitive" } },
		{ name: { contains: trimmedSearch, mode: "insensitive" } },
		{ slug: { contains: trimmedSearch, mode: "insensitive" } },
		{ brand: { contains: trimmedSearch, mode: "insensitive" } },
	];
}

function resolveOrderBy(query: ProductListQuery): Prisma.ProductOrderByWithRelationInput {
	const sortBy = query.sortBy ?? "createdAt";
	const sortDirection = query.sortDirection ?? "desc";
	if (!SORTABLE_FIELDS.has(sortBy)) {
		return { createdAt: "desc" };
	}
	return { [sortBy]: sortDirection };
}

function buildListWhere(query: ProductListQuery): Prisma.ProductWhereInput {
	const where: Prisma.ProductWhereInput = {
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

const ProductRepositoryPorts = {
	toDomain,
	toCreateInput: toPrismaCreateInput,
	toUpdateInput: toPrismaUpdateInput,
	buildListWhere,
	buildListOrderBy: resolveOrderBy,
	buildFindByIdWhere: (id: string): Prisma.ProductWhereInput => ({ id, deletedAt: null }),
	buildUpdateWhere: (id: string, expectedVersion?: number): Prisma.ProductWhereUniqueInput => ({ id, version: expectedVersion }),
	stampUpdate: (data: Prisma.ProductUpdateInput): Prisma.ProductUpdateInput => ({ ...data, version: { increment: 1 }, updatedAt: nowEpochMs() }),
	stampSoftDelete: (): Prisma.ProductUpdateInput => ({ deletedAt: nowEpochMs(), updatedAt: nowEpochMs() }),
	stampRestore: (): Prisma.ProductUpdateInput => ({ deletedAt: null, updatedAt: nowEpochMs() }),
};

@Injectable()
export class GeneratedProductRepository extends BaseRepository<
	ProductEntity,
	CreateProductInput,
	UpdateProductInput,
	ProductListQuery,
	Prisma.ProductGetPayload<Record<string, never>>,
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
