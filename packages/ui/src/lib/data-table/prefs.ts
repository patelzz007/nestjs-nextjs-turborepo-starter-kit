import type { ColumnPinningState, ColumnVisibilityState, SortingState } from "@tanstack/react-table";
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
			const countParsed = z.number().safeParse(count);
			const key = cellParsed.success ? toDataTableCellString(cellParsed.data) : "";
			if (countParsed.success) {
				map.set(key, countParsed.data);
			}
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

const dataTableRowFieldSchema = z.union([DataTableCellScalarSchema, DataTableStructuredCellSchema]);

export function readDataTableRowField(row: object, key: string): DataTableCellScalar | object {
	const recordParsed = z.record(z.string(), dataTableRowFieldSchema).safeParse(row);
	if (!recordParsed.success) {
		return "";
	}
	const value = recordParsed.data[key];
	return value ?? "";
}

export interface ReconcileDataTablePrefsInput {
	readonly prefs: DataTablePersistedPrefs | null;
	readonly columnIds: readonly string[];
	readonly pageSizeOptions: readonly number[];
	readonly defaultPageSize: number;
	readonly isServerMode: boolean;
}

export interface ReconciledDataTablePrefs {
	readonly columnVisibility: ColumnVisibilityState;
	readonly pageSize: number;
	readonly sorting: SortingState;
	readonly columnPinning: ColumnPinningState;
}

function reconcilePageSize(saved: number | undefined, pageSizeOptions: readonly number[], defaultPageSize: number): number {
	if (saved === undefined) {
		return defaultPageSize;
	}
	if (pageSizeOptions.includes(saved)) {
		return saved;
	}
	return pageSizeOptions[0] ?? defaultPageSize;
}

function reconcileColumnVisibility(saved: ColumnVisibilityState | undefined, columnIds: readonly string[]): ColumnVisibilityState {
	if (saved === undefined) {
		return {};
	}
	const allowed = new Set(columnIds);
	const next: ColumnVisibilityState = {};
	for (const [columnId, visible] of Object.entries(saved)) {
		if (allowed.has(columnId)) {
			next[columnId] = visible;
		}
	}
	return next;
}

function reconcileSorting(saved: SortingState | undefined, columnIds: readonly string[], isServerMode: boolean): SortingState {
	if (isServerMode || saved === undefined) {
		return [];
	}
	const allowed = new Set(columnIds);
	return saved.filter((entry) => allowed.has(entry.id));
}

function reconcileColumnPinning(saved: DataTablePersistedPrefs["columnPinning"], columnIds: readonly string[]): ColumnPinningState {
	const allowed = new Set(columnIds);
	const filterIds = (ids: string[] | undefined): string[] => (ids ?? []).filter((id) => allowed.has(id));
	return {
		start: filterIds(saved?.start),
		end: filterIds(saved?.end),
	};
}

/** Validates persisted prefs against the live table configuration. */
export function reconcileDataTablePrefs(input: ReconcileDataTablePrefsInput): ReconciledDataTablePrefs {
	const prefs = input.prefs;
	return {
		columnVisibility: reconcileColumnVisibility(prefs?.columnVisibility, input.columnIds),
		pageSize: reconcilePageSize(prefs?.pageSize, input.pageSizeOptions, input.defaultPageSize),
		sorting: reconcileSorting(prefs?.sorting, input.columnIds, input.isServerMode),
		columnPinning: reconcileColumnPinning(prefs?.columnPinning, input.columnIds),
	};
}
