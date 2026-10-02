import { z } from "zod";

// ── Shared primitives ─────────────────────────────────────────────────────

export const GeoIdSchema = z.number().int().nonnegative();

/**
 * Geo `createdAt` / `updatedAt` on the wire: epoch milliseconds (UTC), the one
 * time representation of the API (platform roadmap → "Timestamps"). The geo
 * tables are reference data imported from dr5hn/countries-states-cities-database
 * with `TIMESTAMP(0)` columns; the repository maps every `Date` with
 * `getTime()` (ADR 022). Until Phase C2 these fields leaked out as ISO strings.
 */
export const GeoDateTimeFieldSchema = z.number().int().nonnegative().meta({ description: "Epoch milliseconds (UTC)", example: 1388577661000 });

/** Upper bound for the comma-separated `include` parameter. */
const GEO_INCLUDE_MAX_LENGTH = 100;

export const GeoSortDirectionSchema = z.enum(["asc", "desc"]);
export type GeoSortDirection = z.output<typeof GeoSortDirectionSchema>;

export const GeoIncludeSchema = z.string().max(GEO_INCLUDE_MAX_LENGTH).optional().describe("Comma-separated related entities to include (e.g. states,cities)");
export type GeoInclude = z.output<typeof GeoIncludeSchema>;

/** Geo lists keep their historical page size (the old shared pagination default). */
export const GEO_LIST_DEFAULT_LIMIT = 10;

export const GeoIdParamSchema = z
	.object({
		id: z.coerce.number().int().nonnegative(),
	})
	.strict();

export type GeoIdParam = z.output<typeof GeoIdParamSchema>;
