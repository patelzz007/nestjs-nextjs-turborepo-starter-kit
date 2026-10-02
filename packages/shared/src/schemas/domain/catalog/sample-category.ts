import { BULK_MUTATION_MAX_ITEMS } from "../../api/bulk-mutation";
import { z } from "zod";
import { defineListQuery, listFilter, ListSearchSchema } from "../../api/list-query";

import type { PaginatedServiceResult } from "../../api/api-response";

/** Zod contracts for SampleCategory. */
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
/** `GET /sample-category` list query — see docs/list-queries.md. */
export const sampleCategoryListQuery = defineListQuery({
	sortable: ["name", "slug", "sortOrder", "createdAt"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {
		isActive: listFilter.boolean({ eq: true }),
		createdAt: listFilter.epochMs({ gte: true, lte: true }),
	},
	params: { search: ListSearchSchema },
});
export const SampleCategoryListQuerySchema = sampleCategoryListQuery.schema;
export type SampleCategoryListQuery = z.output<typeof SampleCategoryListQuerySchema>;
export type SampleCategoryListSortField = (typeof sampleCategoryListQuery.sortable)[number];

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
	.meta({ description: "A sample category. Response schema: unknown keys are stripped, never rejected (ADR 022)." });
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

/** `POST /sample-category/bulk` payload — the created categories, in request order. */
export const BulkCreateSampleCategoryResponseSchema = z.array(SampleCategorySchema);
