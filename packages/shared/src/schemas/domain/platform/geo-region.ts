import { z } from "zod";

import { DataValueSchema } from "../../api/common";
import { JsonValueSchema } from "../../runtime/json";
import { defineListQuery, listFilter, ListSearchSchema } from "../../api/list-query";
import { GEO_LIST_DEFAULT_LIMIT, GeoDateTimeFieldSchema, GeoIdSchema, GeoIncludeSchema } from "./geo-shared";

/**
 * Region response DTO. Open (not `.strict()`): the response interceptor strips
 * unknown keys instead of failing, so adding a column never breaks a client.
 */
export const RegionSchema = z.object({
	id: GeoIdSchema,
	name: z.string(),
	translations: DataValueSchema.nullable(),
	wikiDataId: z.string().nullable(),
	flag: z.boolean(),
	createdAt: GeoDateTimeFieldSchema,
	updatedAt: GeoDateTimeFieldSchema,
});

export type Region = z.output<typeof RegionSchema>;

export const CreateRegionSchema = z
	.object({
		name: z.string().min(1).max(255),
		translations: JsonValueSchema.optional(),
		wikiDataId: z.string().max(255).optional(),
		flag: z.boolean().optional().default(true),
	})
	.strict();

export type CreateRegionInput = z.output<typeof CreateRegionSchema>;

export const UpdateRegionSchema = z
	.object({
		name: z.string().min(1).max(255).optional(),
		translations: JsonValueSchema.optional(),
		wikiDataId: z.string().max(255).nullable().optional(),
		flag: z.boolean().optional(),
	})
	.strict()
	.refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided" });

export type UpdateRegionInput = z.output<typeof UpdateRegionSchema>;

/** `GET /geo/regions` list query — see docs/technical/api/list-queries.md. */
export const regionListQuery = defineListQuery({
	sortable: ["id", "name"],
	defaultSort: [{ field: "id", direction: "asc" }],
	filter: {
		id: listFilter.number({ eq: true, in: true }),
		flag: listFilter.boolean({ eq: true }),
	},
	params: { search: ListSearchSchema, include: GeoIncludeSchema },
	defaultLimit: GEO_LIST_DEFAULT_LIMIT,
});
export const RegionListQuerySchema = regionListQuery.schema;
export type RegionListQuery = z.output<typeof RegionListQuerySchema>;
export type RegionListSortField = (typeof regionListQuery.sortable)[number];
