import { BULK_MUTATION_MAX_ITEMS } from "../api/bulk-mutation";
import { z } from "zod";
import { BooleanQueryParamSchema } from "../api/query-params";

import type { PaginatedServiceResult } from "../api/api-response";

/** Generated Zod contracts for SampleCategory. */
export const CreateSampleCategorySchema = z
	.object({
		description: z.string().nullable().optional(),
		isActive: z.boolean().optional(),
		name: z.string(),
		slug: z.string(),
		sortOrder: z.number().int().optional(),
	})
	.strict();
export type CreateSampleCategoryInput = z.output<typeof CreateSampleCategorySchema>;

export const BulkCreateSampleCategorySchema = z
	.object({
		items: z.array(CreateSampleCategorySchema).min(1).max(BULK_MUTATION_MAX_ITEMS),
	})
	.strict();
export type BulkCreateSampleCategoryInput = z.output<typeof BulkCreateSampleCategorySchema>;

export const UpdateSampleCategorySchema = CreateSampleCategorySchema.partial();
export type UpdateSampleCategoryInput = z.output<typeof UpdateSampleCategorySchema>;

export const SampleCategoryIdParamSchema = z.object({ id: z.uuid() }).strict();
export const SampleCategoryListSortBySchema = z.enum(["name", "slug", "sortOrder", "createdAt"]);
export type SampleCategoryListSortBy = z.output<typeof SampleCategoryListSortBySchema>;
export const SampleCategoryListQuerySchema = z
	.object({
		page: z.coerce.number().int().min(1).optional().default(1),
		cursor: z.string().min(1).optional(),
		limit: z.coerce.number().int().positive().max(100).default(20),
		sortBy: SampleCategoryListSortBySchema.optional(),
		sortDirection: z.enum(["asc", "desc"]).optional(),
		search: z.string().trim().min(1).optional(),
		isActive: BooleanQueryParamSchema,
	})
	.strict();
export type SampleCategoryListQuery = z.output<typeof SampleCategoryListQuerySchema>;

export const SampleCategorySchema = z
	.object({
		id: z.uuid(),
		description: z.string().nullable(),
		isActive: z.boolean(),
		name: z.string(),
		slug: z.string(),
		sortOrder: z.number().int(),
		deletedAt: z.number().int().nonnegative().nullable(),
		createdAt: z.number().int().nonnegative(),
		updatedAt: z.number().int().nonnegative(),
	})
	.strict();
export type SampleCategory = z.output<typeof SampleCategorySchema>;

export const SampleCategoryListResponseSchema = z
	.object({
		items: z.array(SampleCategorySchema),
		limit: z.number().int().positive(),
		nextCursor: z.string().nullable(),
		hasNext: z.boolean(),
	})
	.strict();
export type SampleCategoryListResponse = PaginatedServiceResult<SampleCategory>;
