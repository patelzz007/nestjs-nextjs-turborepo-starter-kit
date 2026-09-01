import { z } from "zod";

import { DataValueSchema } from "../api/common";
import { PaginationSchema } from "../api/pagination";
import { JsonObjectSchema } from "../runtime/json";

// ── Shared primitives ─────────────────────────────────────────────────────

const IdSchema = z.number().int().nonnegative();

/**
 * Prisma DateTime fields serialize as ISO strings, but EpochMsSchema expects
 * numbers. This schema accepts both — the frontend doesn't need to distinguish.
 */
const DateTimeFieldSchema = z.union([z.number(), z.string()]);

// ── Region ────────────────────────────────────────────────────────────────

export const RegionSchema = z
	.object({
		id: IdSchema,
		name: z.string(),
		translations: DataValueSchema.nullable(),
		wikiDataId: z.string().nullable(),
		flag: z.boolean(),
		createdAt: DateTimeFieldSchema,
		updatedAt: DateTimeFieldSchema,
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

export const GeoSortDirectionSchema = z.enum(["asc", "desc"]);
export type GeoSortDirection = z.output<typeof GeoSortDirectionSchema>;

export const GeoIncludeSchema = z.string().optional().describe("Comma-separated related entities to include (e.g. states,states.cities)");
export type GeoInclude = z.output<typeof GeoIncludeSchema>;

export const GeoIdsSchema = z.string().optional().describe("Comma-separated IDs for batch lookup (e.g. 1,2,3)");
export type GeoIds = z.output<typeof GeoIdsSchema>;

export const GeoCursorSchema = z.string().optional().describe("Opaque cursor for cursor-based pagination");
export type GeoCursor = z.output<typeof GeoCursorSchema>;

export const RegionListQuerySchema = PaginationSchema.extend({
	search: z.string().optional(),
	flag: z.coerce.boolean().optional(),
	ids: GeoIdsSchema,
	sort: z.string().optional().describe("Sort field (prefix with - for desc, e.g. -name)"),
	cursor: GeoCursorSchema,
	include: GeoIncludeSchema,
}).strict();

export type RegionListQuery = z.output<typeof RegionListQuerySchema>;

// ── Subregion ─────────────────────────────────────────────────────────────

export const SubregionSchema = z
	.object({
		id: IdSchema,
		name: z.string(),
		translations: DataValueSchema.nullable(),
		wikiDataId: z.string().nullable(),
		flag: z.boolean(),
		regionId: IdSchema,
		createdAt: DateTimeFieldSchema,
		updatedAt: DateTimeFieldSchema,
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

// ── Country ───────────────────────────────────────────────────────────────

export const CountrySchema = z
	.object({
		id: IdSchema,
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
		regionId: IdSchema.nullable(),
		subregionId: IdSchema.nullable(),
		createdAt: DateTimeFieldSchema,
		updatedAt: DateTimeFieldSchema,
	})
	.strict();

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

export const CountryListQuerySchema = PaginationSchema.extend({
	search: z.string().optional(),
	iso2: z.string().length(2).optional(),
	regionId: z.coerce.number().int().nonnegative().optional(),
	subregionId: z.coerce.number().int().nonnegative().optional(),
	flag: z.coerce.boolean().optional(),
	ids: GeoIdsSchema,
	sort: z.string().optional(),
	cursor: GeoCursorSchema,
	include: GeoIncludeSchema,
}).strict();

export type CountryListQuery = z.output<typeof CountryListQuerySchema>;

// ── State ─────────────────────────────────────────────────────────────────

export const StateSchema = z
	.object({
		id: IdSchema,
		name: z.string(),
		countryCode: z.string(),
		fipsCode: z.string().nullable(),
		iso2: z.string().nullable(),
		iso3166_2: z.string().nullable(),
		type: z.string().nullable(),
		level: z.number().int().nullable(),
		parentId: IdSchema.nullable(),
		native: z.string().nullable(),
		latitude: z.number().nullable(),
		longitude: z.number().nullable(),
		timezone: z.string().nullable(),
		translations: DataValueSchema.nullable(),
		wikiDataId: z.string().nullable(),
		flag: z.boolean(),
		countryId: IdSchema,
		createdAt: DateTimeFieldSchema,
		updatedAt: DateTimeFieldSchema,
	})
	.strict();

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

export const StateListQuerySchema = PaginationSchema.extend({
	search: z.string().optional(),
	countryId: z.coerce.number().int().nonnegative().optional(),
	countryCode: z.string().length(2).optional(),
	flag: z.coerce.boolean().optional(),
	ids: GeoIdsSchema,
	sort: z.string().optional(),
	cursor: GeoCursorSchema,
	include: GeoIncludeSchema,
}).strict();

export type StateListQuery = z.output<typeof StateListQuerySchema>;

// ── City ──────────────────────────────────────────────────────────────────

export const CitySchema = z
	.object({
		id: IdSchema,
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
		stateId: IdSchema,
		countryId: IdSchema,
		createdAt: DateTimeFieldSchema,
		updatedAt: DateTimeFieldSchema,
	})
	.strict();

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
		translations: DataValueSchema.optional(),
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
		translations: DataValueSchema.nullable().optional(),
		wikiDataId: z.string().max(255).nullable().optional(),
		flag: z.boolean().optional(),
	})
	.strict()
	.refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided" });

export type UpdateCityInput = z.output<typeof UpdateCitySchema>;

export const CityListQuerySchema = PaginationSchema.extend({
	search: z.string().optional(),
	stateId: z.coerce.number().int().nonnegative().optional(),
	countryId: z.coerce.number().int().nonnegative().optional(),
	countryCode: z.string().length(2).optional(),
	stateCode: z.string().optional(),
	flag: z.coerce.boolean().optional(),
	ids: GeoIdsSchema,
	sort: z.string().optional(),
	cursor: GeoCursorSchema,
	include: GeoIncludeSchema,
}).strict();

export type CityListQuery = z.output<typeof CityListQuerySchema>;

// ── ID Param ──────────────────────────────────────────────────────────────

export const GeoIdParamSchema = z
	.object({
		id: z.coerce.number().int().nonnegative(),
	})
	.strict();

export type GeoIdParam = z.output<typeof GeoIdParamSchema>;

// ── Autocomplete ──────────────────────────────────────────────────────────

export const GeoAutocompleteQuerySchema = z
	.object({
		q: z.string().min(1).max(100),
		country: z.string().length(2).optional(),
		limit: z.coerce.number().int().min(1).max(20).optional().default(10),
	})
	.strict();

export type GeoAutocompleteQuery = z.output<typeof GeoAutocompleteQuerySchema>;

export const GeoAutocompleteItemSchema = z.object({
	id: IdSchema,
	name: z.string(),
	entityType: z.enum(["region", "subregion", "country", "state", "city"]),
	countryCode: z.string().nullable().optional(),
	stateCode: z.string().nullable().optional(),
	latitude: z.number().nullable().optional(),
	longitude: z.number().nullable().optional(),
	emoji: z.string().nullable().optional(),
});

export type GeoAutocompleteItem = z.output<typeof GeoAutocompleteItemSchema>;

// ── Bulk Import ───────────────────────────────────────────────────────────

export const GeoImportInputSchema = z
	.object({
		entity: z.enum(["region", "subregion", "country", "state", "city"]),
		data: z.array(JsonObjectSchema).min(1).max(10000),
		upsert: z.boolean().optional().default(false),
	})
	.strict();

export type GeoImportInput = z.output<typeof GeoImportInputSchema>;

export const GeoImportResultSchema = z.object({
	created: z.number(),
	updated: z.number(),
	skipped: z.number(),
	errors: z.array(z.object({ row: z.number(), message: z.string() })),
});

export type GeoImportResult = z.output<typeof GeoImportResultSchema>;

// ── Import Validation ─────────────────────────────────────────────────────

export const GeoImportValidateInputSchema = z
	.object({
		entity: z.enum(["region", "subregion", "country", "state", "city"]),
		data: z.array(JsonObjectSchema).min(1).max(10000),
	})
	.strict();

export type GeoImportValidateInput = z.output<typeof GeoImportValidateInputSchema>;

export const GeoImportValidationResultSchema = z.object({
	valid: z.boolean(),
	totalRows: z.number(),
	validRows: z.number(),
	errors: z.array(z.object({ row: z.number(), field: z.string().nullable(), message: z.string() })),
});

export type GeoImportValidationResult = z.output<typeof GeoImportValidationResultSchema>;

// ── Export ────────────────────────────────────────────────────────────────

export const GeoExportQuerySchema = z
	.object({
		format: z.enum(["json", "csv"]).optional().default("json"),
		countryCode: z.string().length(2).optional(),
		regionId: z.coerce.number().int().nonnegative().optional(),
	})
	.strict();

export type GeoExportQuery = z.output<typeof GeoExportQuerySchema>;

// ── Cascade Preview ───────────────────────────────────────────────────────

export const CascadePreviewSchema = z.object({
	entity: z.enum(["region", "subregion", "country", "state"]),
	id: z.coerce.number().int().nonnegative(),
});

export type CascadePreviewInput = z.output<typeof CascadePreviewSchema>;

export const CascadePreviewResultSchema = z.object({
	entity: z.string(),
	id: z.number(),
	name: z.string(),
	willDelete: z.object({
		subregions: z.number().nullable().optional(),
		countries: z.number().nullable().optional(),
		states: z.number().nullable().optional(),
		cities: z.number().nullable().optional(),
	}),
});

export type CascadePreviewResult = z.output<typeof CascadePreviewResultSchema>;
