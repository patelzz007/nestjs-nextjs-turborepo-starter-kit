import { z } from "zod";

export const PaginationSchema = z
	.object({
		page: z.coerce.number().int().min(1).optional().default(1).meta({
			description: "Page number (1-indexed) for offset navigation",
			example: 1,
		}),
		cursor: z.string().min(1).optional().meta({
			description: "Opaque cursor returned by the previous list response (sequential navigation)",
			example: "Y2x1c18x",
		}),
		limit: z.coerce.number().int().min(1).max(100).optional().default(10).meta({
			description: "Maximum number of results to return",
			example: 20,
		}),
	})
	.strict();

export type PaginationInput = z.output<typeof PaginationSchema>;

export const PaginationMetaSchema = z
	.object({
		limit: z.number().int().min(1).max(100),
		total: z.number().int().nonnegative(),
		page: z.number().int().min(1),
		totalPages: z.number().int().min(1),
		nextCursor: z.string().nullable(),
		hasNext: z.boolean(),
		hasPrevious: z.boolean(),
	})
	.strict();

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
