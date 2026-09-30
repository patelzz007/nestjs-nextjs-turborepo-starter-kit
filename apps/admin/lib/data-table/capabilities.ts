import type { RowData } from "@tanstack/react-table";
import type { DataTableCheckboxConfig, DataTableBulkSelectionContext } from "@workspace/ui/lib/data-table/checkbox";

export interface ResourceTableCheckboxOptions<TData extends RowData> {
	/**
	 * `useAuthorization().can(PERMISSION.<RESOURCE>.DELETE)` — the container
	 * decides; bulk delete is offered only when true.
	 */
	readonly canDelete: boolean;
	readonly exportFilename: string;
	readonly exportableColumns?: readonly string[];
	readonly onDeleteAll?: (selectedRows: TData[], context: DataTableBulkSelectionContext) => void | Promise<void>;
	/** Already filtered by the caller to the actions the session may run. */
	readonly bulkActions?: DataTableCheckboxConfig<TData>["bulkActions"];
}

/** Checkbox + multi-format export; bulk delete only when the session may delete. */
export function buildResourceTableCheckbox<TData extends RowData>(options: ResourceTableCheckboxOptions<TData>): DataTableCheckboxConfig<TData> {
	const includeDelete = options.onDeleteAll !== undefined && options.canDelete;

	return {
		export: true,
		exportFilename: options.exportFilename,
		...(options.exportableColumns !== undefined ? { exportableColumns: [...options.exportableColumns] } : {}),
		...(options.bulkActions !== undefined && options.bulkActions.length > 0 ? { bulkActions: options.bulkActions } : {}),
		...(includeDelete ? { onDeleteAll: options.onDeleteAll } : {}),
	};
}

/** Export-only checkbox config for read-only audit tables (no bulk delete). */
export function buildReadOnlyTableCheckbox(exportFilename: string, exportableColumns?: readonly string[]): DataTableCheckboxConfig {
	return {
		export: true,
		exportFilename,
		...(exportableColumns !== undefined ? { exportableColumns: [...exportableColumns] } : {}),
	};
}
