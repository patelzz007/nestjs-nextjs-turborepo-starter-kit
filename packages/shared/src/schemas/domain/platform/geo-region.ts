import { z } from "zod";

import { DataValueSchema } from "../../api/common";
import { PaginationSchema } from "../../api/pagination";
import { GeoCursorSchema, GeoDateTimeFieldSchema, GeoIdSchema, GeoIdsSchema, GeoIncludeSchema } from "./geo-shared";

export const RegionSchema = z
	.object({
		id: GeoIdSchema,
		name: z.string(),
		translations: DataValueSchema.nullable(),
		wikiDataId: z.string().nullable(),
		flag: z.boolean(),
		createdAt: GeoDateTimeFieldSchema,
		updatedAt: GeoDateTimeFieldSchema,
	})
	.strict();

export type Region = z.output<typeof RegionSchema>;

export const CreateRegionSchema = z
	.object({
		name: z.string().min(1).max(255),
		translations: DataValueSchema.optional(),
		wikiDataId: z.string().max(255).optional(),
		flag: z.boolean().optional().default(true),
	})
	.strict();

export type CreateRegionInput = z.output<typeof CreateRegionSchema>;

export const UpdateRegionSchema = z
	.object({
		name: z.string().min(1).max(255).optional(),
		translations: DataValueSchema.optional(),
		wikiDataId: z.string().max(255).nullable().optional(),
		flag: z.boolean().optional(),
	})
	.strict()
	.refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided" });

export type UpdateRegionInput = z.output<typeof UpdateRegionSchema>;

export const RegionListQuerySchema = PaginationSchema.extend({
	search: z.string().optional(),
	flag: z.coerce.boolean().optional(),
	ids: GeoIdsSchema,
	sort: z.string().optional().describe("Sort field (prefix with - for desc, e.g. -name)"),
	cursor: GeoCursorSchema,
	include: GeoIncludeSchema,
}).strict();

export type RegionListQuery = z.output<typeof RegionListQuerySchema>;
