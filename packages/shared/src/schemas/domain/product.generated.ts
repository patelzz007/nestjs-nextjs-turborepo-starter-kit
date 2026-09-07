import { BULK_MUTATION_MAX_ITEMS } from "../api/bulk-mutation";
import { z } from "zod";
import { BooleanQueryParamSchema } from "../api/query-params";

import type { PaginatedServiceResult } from "../api/api-response";

/** Generated Zod contracts for Product. */
export const CreateProductSchema = z
	.object({
		brand: z.string().nullable().optional(),
		categoryId: z.uuid(),
		compareAtPrice: z.coerce.number().nullable().optional(),
		description: z.string().nullable().optional(),
		imageUrl: z.string().nullable().optional(),
		isActive: z.boolean().optional(),
		isFeatured: z.boolean().optional(),
		name: z.string(),
		price: z.coerce.number(),
		shortDescription: z.string().nullable().optional(),
		sku: z.string(),
		slug: z.string(),
		stockQuantity: z.number().int().optional(),
		weightGrams: z.number().int().nullable().optional(),
	})
	.strict();
export type CreateProductInput = z.output<typeof CreateProductSchema>;

export const BulkCreateProductSchema = z
	.object({
		items: z.array(CreateProductSchema).min(1).max(BULK_MUTATION_MAX_ITEMS),
	})
	.strict();
export type BulkCreateProductInput = z.output<typeof BulkCreateProductSchema>;

export const UpdateProductSchema = CreateProductSchema.partial();
export type UpdateProductInput = z.output<typeof UpdateProductSchema>;

export const ProductIdParamSchema = z.object({ id: z.uuid() }).strict();
export const ProductListSortBySchema = z.enum(["compareAtPrice", "name", "price", "sku", "slug", "stockQuantity", "createdAt"]);
export type ProductListSortBy = z.output<typeof ProductListSortBySchema>;
export const ProductListQuerySchema = z
	.object({
		page: z.coerce.number().int().min(1).optional().default(1),
		cursor: z.string().min(1).optional(),
		limit: z.coerce.number().int().positive().max(100).default(20),
		sortBy: ProductListSortBySchema.optional(),
		sortDirection: z.enum(["asc", "desc"]).optional(),
		search: z.string().trim().min(1).optional(),
		isActive: BooleanQueryParamSchema,
		isFeatured: BooleanQueryParamSchema,
		categoryId: z.uuid().optional(),
		brand: z.string().trim().min(1).optional(),
	})
	.strict();
export type ProductListQuery = z.output<typeof ProductListQuerySchema>;

export const ProductSchema = z
	.object({
		id: z.uuid(),
		brand: z.string().nullable(),
		categoryId: z.uuid(),
		compareAtPrice: z.coerce.number().nullable(),
		description: z.string().nullable(),
		imageUrl: z.string().nullable(),
		isActive: z.boolean(),
		isFeatured: z.boolean(),
		name: z.string(),
		price: z.coerce.number(),
		shortDescription: z.string().nullable(),
		sku: z.string(),
		slug: z.string(),
		stockQuantity: z.number().int(),
		weightGrams: z.number().int().nullable(),
		version: z.number().int().nonnegative(),
		deletedAt: z.number().int().nonnegative().nullable(),
		createdAt: z.number().int().nonnegative(),
		updatedAt: z.number().int().nonnegative(),
	})
	.strict();
export type Product = z.output<typeof ProductSchema>;

export const ProductListResponseSchema = z
	.object({
		items: z.array(ProductSchema),
		limit: z.number().int().positive(),
		nextCursor: z.string().nullable(),
		hasNext: z.boolean(),
	})
	.strict();
export type ProductListResponse = PaginatedServiceResult<Product>;
