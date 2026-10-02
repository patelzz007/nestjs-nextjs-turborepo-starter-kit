import { z } from "zod";

import { DataValueSchema } from "../../api/common";
import { defineListQuery, listFilter, ListSearchSchema } from "../../api/list-query";
import { GEO_LIST_DEFAULT_LIMIT, GeoDateTimeFieldSchema, GeoIdSchema, GeoIncludeSchema } from "./geo-shared";

/**
 * Country response DTO. Open (not `.strict()`): the response interceptor strips
 * unknown keys instead of failing, so adding a column never breaks a client.
 */
export const CountrySchema = z.object({
	id: GeoIdSchema,
	name: z.string(),
	iso3: z.string().nullable(),
	numericCode: z.string().nullable(),
	iso2: z.string().nullable(),
	phonecode: z.string().nullable(),
	capital: z.string().nullable(),
	currency: z.string().nullable(),
	currencyName: z.string().nullable(),
	currencySymbol: z.string().nullable(),
	tld: z.string().nullable(),
	native: z.string().nullable(),
	population: z.number().nullable(),
	gdp: z.number().nullable(),
	region: z.string().nullable(),
	subregion: z.string().nullable(),
	nationality: z.string().nullable(),
	timezones: DataValueSchema.nullable(),
	translations: DataValueSchema.nullable(),
	latitude: z.number().nullable(),
	longitude: z.number().nullable(),
	emoji: z.string().nullable(),
	emojiU: z.string().nullable(),
	wikiDataId: z.string().nullable(),
	flag: z.boolean(),
	regionId: GeoIdSchema.nullable(),
	subregionId: GeoIdSchema.nullable(),
	createdAt: GeoDateTimeFieldSchema,
	updatedAt: GeoDateTimeFieldSchema,
});

export type Country = z.output<typeof CountrySchema>;

export const CreateCountrySchema = z
	.object({
		name: z.string().min(1).max(255),
		iso3: z.string().length(3).optional(),
		numericCode: z.string().length(3).optional(),
		iso2: z.string().length(2).optional(),
		phonecode: z.string().max(255).optional(),
		capital: z.string().max(255).optional(),
		currency: z.string().max(255).optional(),
		currencyName: z.string().max(255).optional(),
		currencySymbol: z.string().max(255).optional(),
		tld: z.string().max(255).optional(),
		native: z.string().max(255).optional(),
		population: z.coerce.number().int().nonnegative().optional(),
		gdp: z.coerce.number().int().nonnegative().optional(),
		region: z.string().max(255).optional(),
		subregion: z.string().max(255).optional(),
		nationality: z.string().max(255).optional(),
		timezones: DataValueSchema.optional(),
		translations: DataValueSchema.optional(),
		latitude: z.coerce.number().min(-90).max(90).optional(),
		longitude: z.coerce.number().min(-180).max(180).optional(),
		emoji: z.string().max(191).optional(),
		emojiU: z.string().max(191).optional(),
		wikiDataId: z.string().max(255).optional(),
		flag: z.boolean().optional().default(true),
		regionId: z.number().int().nonnegative().nullable().optional(),
		subregionId: z.number().int().nonnegative().nullable().optional(),
	})
	.strict();

export type CreateCountryInput = z.output<typeof CreateCountrySchema>;

export const UpdateCountrySchema = z
	.object({
		name: z.string().min(1).max(255).optional(),
		iso3: z.string().length(3).optional(),
		numericCode: z.string().length(3).nullable().optional(),
		iso2: z.string().length(2).optional(),
		phonecode: z.string().max(255).nullable().optional(),
		capital: z.string().max(255).nullable().optional(),
		currency: z.string().max(255).nullable().optional(),
		currencyName: z.string().max(255).nullable().optional(),
		currencySymbol: z.string().max(255).nullable().optional(),
		tld: z.string().max(255).nullable().optional(),
		native: z.string().max(255).nullable().optional(),
		population: z.coerce.number().int().nonnegative().nullable().optional(),
		gdp: z.coerce.number().int().nonnegative().nullable().optional(),
		region: z.string().max(255).nullable().optional(),
		subregion: z.string().max(255).nullable().optional(),
		nationality: z.string().max(255).nullable().optional(),
		timezones: DataValueSchema.nullable().optional(),
		translations: DataValueSchema.nullable().optional(),
		latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
		longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
		emoji: z.string().max(191).nullable().optional(),
		emojiU: z.string().max(191).nullable().optional(),
		wikiDataId: z.string().max(255).nullable().optional(),
		flag: z.boolean().optional(),
		regionId: z.number().int().nonnegative().nullable().optional(),
		subregionId: z.number().int().nonnegative().nullable().optional(),
	})
	.strict()
	.refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided" });

export type UpdateCountryInput = z.output<typeof UpdateCountrySchema>;

/** `GET /geo/countries` list query — see docs/list-queries.md. */
export const countryListQuery = defineListQuery({
	sortable: ["id", "name", "iso2"],
	defaultSort: [{ field: "id", direction: "asc" }],
	filter: {
		id: listFilter.number({ eq: true, in: true }),
		iso2: listFilter.string({ eq: true, in: true }),
		regionId: listFilter.number({ eq: true, in: true, isNull: true }),
		subregionId: listFilter.number({ eq: true, in: true, isNull: true }),
		flag: listFilter.boolean({ eq: true }),
	},
	params: { search: ListSearchSchema, include: GeoIncludeSchema },
	defaultLimit: GEO_LIST_DEFAULT_LIMIT,
});
export const CountryListQuerySchema = countryListQuery.schema;
export type CountryListQuery = z.output<typeof CountryListQuerySchema>;
export type CountryListSortField = (typeof countryListQuery.sortable)[number];
