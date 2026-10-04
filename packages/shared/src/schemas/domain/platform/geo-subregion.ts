import { z } from "zod";

import { DataValueSchema } from "../../api/common";
import { JsonValueSchema } from "../../runtime/json";
import { defineListQuery, listFilter, ListSearchSchema } from "../../api/list-query";
import { GEO_LIST_DEFAULT_LIMIT, GeoDateTimeFieldSchema, GeoIdSchema, GeoIncludeSchema } from "./geo-shared";

/**
 * Subregion response DTO. Open (not `.strict()`): the response interceptor strips
 * unknown keys instead of failing, so adding a column never breaks a client.
 */
export const SubregionSchema = z.object({
	id: GeoIdSchema,
	name: z.string(),
	translations: DataValueSchema.nullable(),
	wikiDataId: z.string().nullable(),
	flag: z.boolean(),
	regionId: GeoIdSchema,
	createdAt: GeoDateTimeFieldSchema,
	updatedAt: GeoDateTimeFieldSchema,
});

export type Subregion = z.output<typeof SubregionSchema>;

export const CreateSubregionSchema = z
	.object({
		name: z.string().min(1).max(255),
		regionId: z.number().int().nonnegative(),
		translations: JsonValueSchema.optional(),
		wikiDataId: z.string().max(255).optional(),
		flag: z.boolean().optional().default(true),
	})
	.strict();

export type CreateSubregionInput = z.output<typeof CreateSubregionSchema>;

export const UpdateSubregionSchema = z
	.object({
		name: z.string().min(1).max(255).optional(),
		regionId: z.number().int().nonnegative().optional(),
		translations: JsonValueSchema.optional(),
		wikiDataId: z.string().max(255).nullable().optional(),
		flag: z.boolean().optional(),
	})
	.strict()
	.refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided" });

export type UpdateSubregionInput = z.output<typeof UpdateSubregionSchema>;

/** `GET /geo/subregions` list query — see docs/technical/api/list-queries.md. */
export const subregionListQuery = defineListQuery({
	sortable: ["id", "name"],
	defaultSort: [{ field: "id", direction: "asc" }],
	filter: {
		id: listFilter.number({ eq: true, in: true }),
		regionId: listFilter.number({ eq: true, in: true }),
		flag: listFilter.boolean({ eq: true }),
	},
	params: { search: ListSearchSchema, include: GeoIncludeSchema },
	defaultLimit: GEO_LIST_DEFAULT_LIMIT,
});
export const SubregionListQuerySchema = subregionListQuery.schema;
export type SubregionListQuery = z.output<typeof SubregionListQuerySchema>;
export type SubregionListSortField = (typeof subregionListQuery.sortable)[number];
