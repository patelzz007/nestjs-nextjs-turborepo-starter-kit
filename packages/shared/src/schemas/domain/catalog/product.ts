import { BULK_MUTATION_MAX_ITEMS } from "../../api/bulk-mutation";
import { z } from "zod";
import { defineListQuery, listFilter, ListSearchSchema } from "../../api/list-query";

import type { PaginatedServiceResult } from "../../api/api-response";

/** Zod contracts for Product. */
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
/**
 * `GET /product` list query — see docs/list-queries.md. Sort, filter and search
 * whitelists live here once and drive the API, Swagger and the typed client.
 */
export const productListQuery = defineListQuery({
	sortable: ["name", "price", "compareAtPrice", "sku", "slug", "stockQuantity", "createdAt"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {
		isActive: listFilter.boolean({ eq: true }),
		isFeatured: listFilter.boolean({ eq: true }),
		categoryId: listFilter.uuid({ eq: true, in: true }),
		brand: listFilter.string({ eq: true, contains: true, isNull: true }),
		price: listFilter.number({ gte: true, lte: true }),
		stockQuantity: listFilter.number({ eq: true, gte: true, lte: true }),
		createdAt: listFilter.epochMs({ gte: true, lte: true }),
	},
	params: { search: ListSearchSchema },
});
export const ProductListQuerySchema = productListQuery.schema;
export type ProductListQuery = z.output<typeof ProductListQuerySchema>;
export type ProductListSortField = (typeof productListQuery.sortable)[number];

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
	.meta({ description: "A product. Response schema: unknown keys are stripped, never rejected (ADR 022)." });
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

/** `POST /product/bulk` payload — the created products, in request order. */
export const BulkCreateProductResponseSchema = z.array(ProductSchema);
