import { z } from "zod";

export const PaginationSchema = z
	.object({
		page: z.coerce.number().int().min(1).optional().default(1).meta({
			description: "Page number (1-based)",
			example: 1,
		}),
		limit: z.coerce.number().int().min(1).max(100).optional().default(10).meta({
			description: "Results per page",
			example: 10,
		}),
	})
	.strict();

export type PaginationInput = z.output<typeof PaginationSchema>;

export const PaginationMetaSchema = z.object({
	total: z.number(),
	page: z.number(),
	limit: z.number(),
	totalPages: z.number(),
	hasNext: z.boolean(),
	hasPrevious: z.boolean(),
});

export type PaginationMeta = z.output<typeof PaginationMetaSchema>;

export const PaginatedResponseSchema = <T extends z.ZodType>(
	itemSchema: T,
): z.ZodObject<{
	success: z.ZodLiteral<true>;
	data: z.ZodArray<T>;
	meta: typeof PaginationMetaSchema;
}> =>
	z.object({
		success: z.literal(true),
		data: z.array(itemSchema),
		meta: PaginationMetaSchema,
	});

/**
 * The generic type twin of {@link PaginatedResponseSchema} — derived from the
 * factory (rule 5) rather than hand-written, so the type can never drift from
 * the schema. Uses an instantiation expression on the generic factory:
 * `PaginatedResponse<T>` ≡ `{ success: true; data: T[]; meta: PaginationMeta }`.
 */
export type PaginatedResponse<T> = z.output<ReturnType<typeof PaginatedResponseSchema<z.ZodType<T>>>>;
