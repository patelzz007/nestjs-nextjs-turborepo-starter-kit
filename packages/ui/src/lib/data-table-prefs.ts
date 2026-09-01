import { z } from "zod";

const sortingStateEntrySchema = z.object({
	id: z.string(),
	desc: z.boolean(),
});

const columnPinningStateSchema = z.object({
	start: z.array(z.string()).optional(),
	end: z.array(z.string()).optional(),
});

/** Persisted DataTable preferences validated at the localStorage boundary. */
export const DataTablePersistedPrefsSchema = z.object({
	columnVisibility: z.record(z.string(), z.boolean()).optional(),
	pageSize: z.number().int().positive().optional(),
	sorting: z.array(sortingStateEntrySchema).optional(),
	columnPinning: columnPinningStateSchema.optional(),
});

export type DataTablePersistedPrefs = z.output<typeof DataTablePersistedPrefsSchema>;

const dataTablePrefsPatchSchema = DataTablePersistedPrefsSchema.partial();

export type DataTablePersistedPrefsPatch = z.output<typeof dataTablePrefsPatchSchema>;

/** Scalar cell values safe for export stringification. */
export const DataTableCellScalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export type DataTableCellScalar = z.output<typeof DataTableCellScalarSchema>;

/** Structured cell object values (nested scalar maps). */
export const DataTableStructuredCellSchema = z.record(z.string(), DataTableCellScalarSchema);

export type DataTableStructuredCell = z.output<typeof DataTableStructuredCellSchema>;

/** Scalar or shallow object cell value at TanStack / export boundaries. */
export const DataTableCellValueSchema = z.union([DataTableCellScalarSchema, DataTableStructuredCellSchema]);

export type DataTableCellValue = z.output<typeof DataTableCellValueSchema>;

export function parseDataTableCellValue(raw: DataTableCellScalar | object | null | undefined): DataTableCellValue {
	if (raw === null || raw === undefined) {
		return "";
	}
	const parsed = DataTableCellValueSchema.safeParse(raw);
	return parsed.success ? parsed.data : "";
}

/** Coerce a TanStack cell value (passed through Zod) into a display string. */
export function displayStringFromTanStackValue(raw: DataTableCellScalar | object | null | undefined): string {
	return toDataTableCellString(parseDataTableCellValue(raw));
}

/**
 * Normalize TanStack faceted unique values into string keys for filter UIs.
 * Accepts the opaque faceting map object from TanStack without leaking library types.
 */
export function normalizeFacetedUniqueValues(raw: object | undefined): Map<string, number> {
	const map = new Map<string, number>();
	if (raw === undefined) {
		return map;
	}

	if (raw instanceof Map) {
		for (const [rawKey, count] of raw.entries()) {
			const cellParsed = DataTableCellValueSchema.safeParse(rawKey);
			const key = cellParsed.success ? toDataTableCellString(cellParsed.data) : "";
			map.set(key, count);
		}
		return map;
	}

	const recordParsed = z.record(z.string(), z.number()).safeParse(raw);
	if (recordParsed.success) {
		for (const [key, count] of Object.entries(recordParsed.data)) {
			map.set(key, count);
		}
	}
	return map;
}

export function parseDataTablePersistedPrefs(raw: string): DataTablePersistedPrefs | null {
	try {
		const parsed = DataTablePersistedPrefsSchema.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

export function parseDataTablePrefsPatch(value: DataTablePersistedPrefsPatch): DataTablePersistedPrefsPatch | null {
	const parsed = dataTablePrefsPatchSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

export function toDataTableCellString(value: DataTableCellScalar | object): string {
	const scalar = DataTableCellScalarSchema.safeParse(value);
	if (scalar.success) {
		return String(scalar.data);
	}
	return JSON.stringify(value) || "";
}

const dataTableRowRecordSchema = z.record(z.string(), z.union([DataTableCellScalarSchema, z.record(z.string(), DataTableCellScalarSchema)]));

export function readDataTableRowField(row: object, key: string): DataTableCellScalar | object {
	const parsed = dataTableRowRecordSchema.safeParse(row);
	if (!parsed.success) {
		return "";
	}
	const value = parsed.data[key];
	return value ?? "";
}
