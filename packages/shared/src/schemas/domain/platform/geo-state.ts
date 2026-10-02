import { z } from "zod";

import { DataValueSchema } from "../../api/common";
import { defineListQuery, listFilter, ListSearchSchema } from "../../api/list-query";
import { GEO_LIST_DEFAULT_LIMIT, GeoDateTimeFieldSchema, GeoIdSchema, GeoIncludeSchema } from "./geo-shared";

/**
 * State response DTO. Open (not `.strict()`): the response interceptor strips
 * unknown keys instead of failing, so adding a column never breaks a client.
 */
export const StateSchema = z.object({
	id: GeoIdSchema,
	name: z.string(),
	countryCode: z.string(),
	fipsCode: z.string().nullable(),
	iso2: z.string().nullable(),
	iso3166_2: z.string().nullable(),
	type: z.string().nullable(),
	level: z.number().int().nullable(),
	parentId: GeoIdSchema.nullable(),
	native: z.string().nullable(),
	latitude: z.number().nullable(),
	longitude: z.number().nullable(),
	timezone: z.string().nullable(),
	translations: DataValueSchema.nullable(),
	wikiDataId: z.string().nullable(),
	flag: z.boolean(),
	countryId: GeoIdSchema,
	createdAt: GeoDateTimeFieldSchema,
	updatedAt: GeoDateTimeFieldSchema,
});

export type State = z.output<typeof StateSchema>;

export const CreateStateSchema = z
	.object({
		name: z.string().min(1).max(255),
		countryCode: z.string().length(2),
		countryId: z.number().int().nonnegative(),
		fipsCode: z.string().max(255).optional(),
		iso2: z.string().max(255).optional(),
		iso3166_2: z.string().max(255).optional(),
		type: z.string().max(191).optional(),
		level: z.number().int().optional(),
		parentId: z.number().int().nonnegative().nullable().optional(),
		native: z.string().max(255).optional(),
		latitude: z.coerce.number().min(-90).max(90).optional(),
		longitude: z.coerce.number().min(-180).max(180).optional(),
		timezone: z.string().max(255).optional(),
		translations: DataValueSchema.optional(),
		wikiDataId: z.string().max(255).optional(),
		flag: z.boolean().optional().default(true),
	})
	.strict();

export type CreateStateInput = z.output<typeof CreateStateSchema>;

export const UpdateStateSchema = z
	.object({
		name: z.string().min(1).max(255).optional(),
		countryCode: z.string().length(2).optional(),
		countryId: z.number().int().nonnegative().optional(),
		fipsCode: z.string().max(255).nullable().optional(),
		iso2: z.string().max(255).nullable().optional(),
		iso3166_2: z.string().max(255).nullable().optional(),
		type: z.string().max(191).nullable().optional(),
		level: z.number().int().nullable().optional(),
		parentId: z.number().int().nonnegative().nullable().optional(),
		native: z.string().max(255).nullable().optional(),
		latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
		longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
		timezone: z.string().max(255).nullable().optional(),
		translations: DataValueSchema.nullable().optional(),
		wikiDataId: z.string().max(255).nullable().optional(),
		flag: z.boolean().optional(),
	})
	.strict()
	.refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided" });

export type UpdateStateInput = z.output<typeof UpdateStateSchema>;

/** `GET /geo/states` list query — see docs/list-queries.md. */
export const stateListQuery = defineListQuery({
	sortable: ["id", "name", "countryCode", "iso2"],
	defaultSort: [{ field: "id", direction: "asc" }],
	filter: {
		id: listFilter.number({ eq: true, in: true }),
		countryId: listFilter.number({ eq: true, in: true }),
		countryCode: listFilter.string({ eq: true, in: true }),
		flag: listFilter.boolean({ eq: true }),
	},
	params: { search: ListSearchSchema, include: GeoIncludeSchema },
	defaultLimit: GEO_LIST_DEFAULT_LIMIT,
});
export const StateListQuerySchema = stateListQuery.schema;
export type StateListQuery = z.output<typeof StateListQuerySchema>;
export type StateListSortField = (typeof stateListQuery.sortable)[number];
