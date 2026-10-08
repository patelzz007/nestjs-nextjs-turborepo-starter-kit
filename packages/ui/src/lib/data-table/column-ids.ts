import type { ColumnDef, RowData } from "@tanstack/react-table";
import { z } from "zod";

/**
 * Column ids `DataTable` owns. It adds these columns itself — the drag handle
 * (`draggable`), the selection checkbox (`checkbox` / bulk selection) and the row
 * actions menu (`actions`) — so a caller's column may never use one of them.
 */
export interface DataTableUtilityColumnIds {
	readonly drag: "drag";
	readonly select: "select";
	readonly actions: "actions";
}

export const DATA_TABLE_UTILITY_COLUMN_ID: DataTableUtilityColumnIds = { drag: "drag", select: "select", actions: "actions" };

export type DataTableUtilityColumnId = DataTableUtilityColumnIds[keyof DataTableUtilityColumnIds];

/** Every utility column id — what export leaves out and what a caller's column cannot be called. */
export const DATA_TABLE_UTILITY_COLUMN_IDS: readonly DataTableUtilityColumnId[] = Object.values(DATA_TABLE_UTILITY_COLUMN_ID);

/** Which built-in column (and prop) each reserved id belongs to — named in the duplicate-id error. */
const UTILITY_COLUMN_OWNER: Record<DataTableUtilityColumnId, string> = {
	drag: "the drag-handle column (`draggable`)",
	select: "the row-selection column (`checkbox`)",
	actions: "the row-actions menu column (`actions`)",
};

/** The two ways a TanStack column is identified: an explicit `id`, or the `accessorKey` it reads. */
const ColumnIdentitySchema = z.object({ id: z.string().optional(), accessorKey: z.union([z.string(), z.number()]).optional() });

/** A column's id as TanStack resolves it: `id`, else `accessorKey`; `undefined` for a column with neither. */
export function resolveDataTableColumnId<TFeatures extends object, TData extends RowData>(column: ColumnDef<TFeatures, TData>): string | undefined {
	const identity = ColumnIdentitySchema.safeParse(column);
	if (!identity.success) {
		return undefined;
	}
	const { id, accessorKey } = identity.data;
	return id ?? (accessorKey === undefined ? undefined : String(accessorKey));
}

/** `true` when `id` belongs to a column `DataTable` adds itself. */
export function isDataTableUtilityColumnId(id: string): id is DataTableUtilityColumnId {
	return DATA_TABLE_UTILITY_COLUMN_IDS.some((utilityId: DataTableUtilityColumnId): boolean => utilityId === id);
}

/** Every column id that appears more than once, in first-seen order. */
export function findDuplicateDataTableColumnIds<TFeatures extends object, TData extends RowData>(columns: readonly ColumnDef<TFeatures, TData>[]): readonly string[] {
	const seen = new Set<string>();
	const duplicates = new Set<string>();
	for (const column of columns) {
		const id = resolveDataTableColumnId(column);
		if (id === undefined) {
			continue;
		}
		if (seen.has(id)) {
			duplicates.add(id);
		}
		seen.add(id);
	}
	return [...duplicates];
}

/**
 * Throws when two columns share an id. Duplicate ids make React render two cells with
 * the same key in every row (`<rowId>_<columnId>`) and make sorting, visibility and
 * pinning state ambiguous — so `DataTable` refuses them instead of rendering garbage.
 */
export function assertUniqueDataTableColumnIds<TFeatures extends object, TData extends RowData>(columns: readonly ColumnDef<TFeatures, TData>[]): void {
	const duplicates = findDuplicateDataTableColumnIds(columns);
	if (duplicates.length === 0) {
		return;
	}
	const reasons = duplicates.map((id: string): string =>
		isDataTableUtilityColumnId(id)
			? `"${id}" is reserved for ${UTILITY_COLUMN_OWNER[id]}; rename your column, or move its content into that prop`
			: `"${id}" is used by more than one column; give each column its own id`,
	);
	throw new Error(`DataTable: duplicate column id. ${reasons.join(". ")}.`);
}
