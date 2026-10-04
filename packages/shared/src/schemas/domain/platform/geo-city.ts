import { z } from "zod";

import { DataValueSchema } from "../../api/common";
import { JsonValueSchema } from "../../runtime/json";
import { defineListQuery, listFilter, ListSearchSchema } from "../../api/list-query";
import { GEO_LIST_DEFAULT_LIMIT, GeoDateTimeFieldSchema, GeoIdSchema, GeoIncludeSchema } from "./geo-shared";

/**
 * City response DTO. Open (not `.strict()`): the response interceptor strips
 * unknown keys instead of failing, so adding a column never breaks a client.
 */
export const CitySchema = z.object({
	id: GeoIdSchema,
	name: z.string(),
	stateCode: z.string(),
	countryCode: z.string(),
	latitude: z.number(),
	longitude: z.number(),
	native: z.string().nullable(),
	timezone: z.string().nullable(),
	translations: DataValueSchema.nullable(),
	wikiDataId: z.string().nullable(),
	flag: z.boolean(),
	stateId: GeoIdSchema,
	countryId: GeoIdSchema,
	createdAt: GeoDateTimeFieldSchema,
	updatedAt: GeoDateTimeFieldSchema,
});

export type City = z.output<typeof CitySchema>;

export const CreateCitySchema = z
	.object({
		name: z.string().min(1).max(255),
		stateCode: z.string().max(255),
		countryCode: z.string().length(2),
		stateId: z.number().int().nonnegative(),
		countryId: z.number().int().nonnegative(),
		latitude: z.coerce.number().min(-90).max(90),
		longitude: z.coerce.number().min(-180).max(180),
		native: z.string().max(255).optional(),
		timezone: z.string().max(255).optional(),
		translations: JsonValueSchema.optional(),
		wikiDataId: z.string().max(255).optional(),
		flag: z.boolean().optional().default(true),
	})
	.strict();

export type CreateCityInput = z.output<typeof CreateCitySchema>;

export const UpdateCitySchema = z
	.object({
		name: z.string().min(1).max(255).optional(),
		stateCode: z.string().max(255).optional(),
		countryCode: z.string().length(2).optional(),
		stateId: z.number().int().nonnegative().optional(),
		countryId: z.number().int().nonnegative().optional(),
		latitude: z.coerce.number().min(-90).max(90).optional(),
		longitude: z.coerce.number().min(-180).max(180).optional(),
		native: z.string().max(255).nullable().optional(),
		timezone: z.string().max(255).nullable().optional(),
		translations: JsonValueSchema.nullable().optional(),
		wikiDataId: z.string().max(255).nullable().optional(),
		flag: z.boolean().optional(),
	})
	.strict()
	.refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided" });

export type UpdateCityInput = z.output<typeof UpdateCitySchema>;

/** `GET /geo/cities` list query — see docs/technical/api/list-queries.md. */
export const cityListQuery = defineListQuery({
	sortable: ["id", "name", "countryCode", "stateCode"],
	defaultSort: [{ field: "id", direction: "asc" }],
	filter: {
		id: listFilter.number({ eq: true, in: true }),
		stateId: listFilter.number({ eq: true, in: true }),
		countryId: listFilter.number({ eq: true, in: true }),
		countryCode: listFilter.string({ eq: true, in: true }),
		stateCode: listFilter.string({ eq: true, in: true }),
		flag: listFilter.boolean({ eq: true }),
	},
	params: { search: ListSearchSchema, include: GeoIncludeSchema },
	defaultLimit: GEO_LIST_DEFAULT_LIMIT,
});
export const CityListQuerySchema = cityListQuery.schema;
export type CityListQuery = z.output<typeof CityListQuerySchema>;
export type CityListSortField = (typeof cityListQuery.sortable)[number];
