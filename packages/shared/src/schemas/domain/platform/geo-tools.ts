import { z } from "zod";

import { JsonObjectSchema } from "../../runtime/json";
import { GeoIdSchema } from "./geo-shared";

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
	id: GeoIdSchema,
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
