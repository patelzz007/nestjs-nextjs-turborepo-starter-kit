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
