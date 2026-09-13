import { z } from "zod";

import { DataValueSchema } from "../../api/common";
import { PaginationSchema } from "../../api/pagination";
import { GeoCursorSchema, GeoDateTimeFieldSchema, GeoIdSchema, GeoIdsSchema, GeoIncludeSchema } from "./geo-shared";

export const SubregionSchema = z
	.object({
		id: GeoIdSchema,
		name: z.string(),
		translations: DataValueSchema.nullable(),
		wikiDataId: z.string().nullable(),
		flag: z.boolean(),
		regionId: GeoIdSchema,
		createdAt: GeoDateTimeFieldSchema,
		updatedAt: GeoDateTimeFieldSchema,
	})
	.strict();

export type Subregion = z.output<typeof SubregionSchema>;

export const CreateSubregionSchema = z
	.object({
		name: z.string().min(1).max(255),
		regionId: z.number().int().nonnegative(),
		translations: DataValueSchema.optional(),
		wikiDataId: z.string().max(255).optional(),
		flag: z.boolean().optional().default(true),
	})
	.strict();

export type CreateSubregionInput = z.output<typeof CreateSubregionSchema>;

export const UpdateSubregionSchema = z
	.object({
		name: z.string().min(1).max(255).optional(),
		regionId: z.number().int().nonnegative().optional(),
		translations: DataValueSchema.optional(),
		wikiDataId: z.string().max(255).nullable().optional(),
		flag: z.boolean().optional(),
	})
	.strict()
	.refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided" });

export type UpdateSubregionInput = z.output<typeof UpdateSubregionSchema>;

export const SubregionListQuerySchema = PaginationSchema.extend({
	search: z.string().optional(),
	regionId: z.coerce.number().int().nonnegative().optional(),
	flag: z.coerce.boolean().optional(),
	ids: GeoIdsSchema,
	sort: z.string().optional(),
	cursor: GeoCursorSchema,
	include: GeoIncludeSchema,
}).strict();

export type SubregionListQuery = z.output<typeof SubregionListQuerySchema>;
