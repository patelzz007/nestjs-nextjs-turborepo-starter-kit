import { z } from "zod";

import { CitySchema } from "./geo-city";

import { JsonObjectSchema } from "../../runtime/json";
import { GeoIdSchema } from "./geo-shared";

/** Every geo hierarchy level an import, export or autocomplete hit can name. */
const GeoEntityTypeSchema = z.enum(["region", "subregion", "country", "state", "city"]);

// ── Autocomplete ──────────────────────────────────────────────────────────

export const GeoAutocompleteQuerySchema = z
	.object({
		q: z.string().min(1).max(100).describe("Search query"),
		country: z.string().length(2).optional().describe("ISO 3166-1 alpha-2 country code to scope results"),
		limit: z.coerce.number().int().min(1).max(20).optional().default(10).describe("Max results (1-20)"),
	})
	.strict();

export type GeoAutocompleteQuery = z.output<typeof GeoAutocompleteQuerySchema>;

export const GeoAutocompleteItemSchema = z.object({
	id: GeoIdSchema,
	name: z.string(),
	entityType: GeoEntityTypeSchema,
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
		entity: GeoEntityTypeSchema,
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
		entity: GeoEntityTypeSchema,
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
		format: z.enum(["json", "csv"]).optional().default("json").describe("Export format (json or csv)"),
		countryCode: z.string().length(2).optional().describe("Filter by ISO 3166-1 alpha-2 country code"),
		regionId: z.coerce.number().int().nonnegative().optional().describe("Filter by region ID"),
	})
	.strict();

export type GeoExportQuery = z.output<typeof GeoExportQuerySchema>;

// ── Cascade Preview ───────────────────────────────────────────────────────

export const CascadePreviewSchema = z.object({
	entity: z.enum(["region", "subregion", "country", "state"]).describe("Entity type (region, subregion, country, state)"),
	id: z.coerce.number().int().nonnegative().describe("Entity ID"),
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

/** `GET /geo/stats` payload — entity counts per geo level. */
export const GeoStatsSchema = z.object({
	regions: z.number().int().nonnegative(),
	subregions: z.number().int().nonnegative(),
	countries: z.number().int().nonnegative(),
	states: z.number().int().nonnegative(),
	cities: z.number().int().nonnegative(),
});

export type GeoStats = z.output<typeof GeoStatsSchema>;

/** `GET /geo/autocomplete` payload. */
export const GeoAutocompleteResponseSchema = z.array(GeoAutocompleteItemSchema);

/**
 * `GET /geo/export` payload — the CITIES of every country matching the filter
 * (`countryCode` / `regionId`), ordered by name, inside the standard success
 * envelope. That is what the endpoint has always sent, for both `format=json`
 * and `format=csv`: CSV rendering is not implemented server-side (the `format`
 * flag is accepted for forward compatibility), so a client that wants CSV
 * converts these rows itself.
 *
 * Previously documented as a union of every level's array; with strip-mode
 * objects that union matched a city row as a `Region` first and stripped
 * every city-specific field, so the contract is the one shape actually sent.
 */
export const GeoExportResponseSchema = z.array(CitySchema);

export type GeoExportResponse = z.output<typeof GeoExportResponseSchema>;
