import { z } from "zod";

// ── Shared primitives ─────────────────────────────────────────────────────

export const GeoIdSchema = z.number().int().nonnegative();

/**
 * Prisma DateTime fields serialize as ISO strings, but EpochMsSchema expects
 * numbers. This schema accepts both — the frontend doesn't need to distinguish.
 */
export const GeoDateTimeFieldSchema = z.union([z.number(), z.string()]);

export const GeoSortDirectionSchema = z.enum(["asc", "desc"]);
export type GeoSortDirection = z.output<typeof GeoSortDirectionSchema>;

export const GeoIncludeSchema = z.string().optional().describe("Comma-separated related entities to include (e.g. states,states.cities)");
export type GeoInclude = z.output<typeof GeoIncludeSchema>;

export const GeoIdsSchema = z.string().optional().describe("Comma-separated IDs for batch lookup (e.g. 1,2,3)");
export type GeoIds = z.output<typeof GeoIdsSchema>;

export const GeoCursorSchema = z.string().optional().describe("Opaque cursor for cursor-based pagination");
export type GeoCursor = z.output<typeof GeoCursorSchema>;

export const GeoIdParamSchema = z
	.object({
		id: z.coerce.number().int().nonnegative(),
	})
	.strict();

export type GeoIdParam = z.output<typeof GeoIdParamSchema>;
