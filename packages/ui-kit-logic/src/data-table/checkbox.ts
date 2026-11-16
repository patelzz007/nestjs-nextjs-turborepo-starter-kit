// DataTable row selection, bulk actions and export formats, shared by the web and native kits.

import { z } from "zod";

import { isArrayValue } from "@workspace/shared";
import type { DataTableLabels } from "./labels";

/** Supported export formats for the checkbox selection toolbar. */
export type DataTableExportFormat = z.output<typeof exportFormatSchema>;

export const DATA_TABLE_EXPORT_FORMATS: readonly DataTableExportFormat[] = ["csv", "json", "pdf", "xlsx"];

const exportFormatSchema = z.enum(["csv", "json", "pdf", "xlsx"]);

/** Selection scope passed to bulk actions (page selection vs all matching server rows). */
export interface DataTableBulkSelectionContext {
	readonly selectAllPages: boolean;
	readonly totalMatchingRows: number;
}

/** What a bulk action does with the selected rows. Checked bivariantly, like `DataTableRowIdReader`. */
export type DataTableBulkActionHandler<TData> = { bivarianceHack(selectedRows: TData[], context: DataTableBulkSelectionContext): void | Promise<void> }["bivarianceHack"];

/** A bulk action. `TIcon` is the kit's glyph type (a React node on the web, a Lucide icon on native). */
export interface DataTableBulkAction<TData, TIcon> {
	readonly key: string;
	readonly label: string;
	readonly icon?: TIcon | undefined;
	readonly onClick: DataTableBulkActionHandler<TData>;
	readonly variant?: "default" | "destructive" | "outline";
}

/** Configuration for row checkboxes, bulk actions, and selection-aware export. */
export interface DataTableCheckboxConfig<TData, TIcon> {
	/** Extra bulk actions shown when one or more rows are selected. */
	readonly bulkActions?: DataTableBulkAction<TData, TIcon>[];
	/** Adds a destructive bulk-delete action using `labels.deleteSelected`. */
	readonly onDeleteAll?: DataTableBulkActionHandler<TData>;
	/** Enable export (`true` = all formats) or pick specific formats. */
	readonly export?: boolean | readonly DataTableExportFormat[];
	readonly exportFilename?: string;
	readonly exportableColumns?: string[];
}

export interface ResolveDataTableCheckboxInput<TData, TIcon> {
	readonly checkbox?: boolean | DataTableCheckboxConfig<TData, TIcon> | undefined;
	readonly labels: DataTableLabels;
	readonly deleteSelectedIcon: TIcon;
}

export interface ResolvedDataTableCheckboxConfig<TData, TIcon> {
	readonly enableBulkSelection: boolean;
	readonly bulkActions: DataTableBulkAction<TData, TIcon>[];
	readonly exportable: boolean;
	readonly exportFormats: readonly DataTableExportFormat[];
	readonly exportFilename?: string | undefined;
	readonly exportableColumns?: string[] | undefined;
}

function includesExportFormat(formats: readonly DataTableExportFormat[], format: DataTableExportFormat): boolean {
	return formats.includes(format);
}

function resolveExportFormats(exportOption: boolean | readonly DataTableExportFormat[] | undefined): readonly DataTableExportFormat[] {
	if (exportOption === true) {
		return DATA_TABLE_EXPORT_FORMATS;
	}
	if (isArrayValue(exportOption)) {
		return exportOption.filter((format): format is DataTableExportFormat => exportFormatSchema.safeParse(format).success);
	}
	return [];
}

/** Normalises the `checkbox` prop into one selection / bulk-action / export config. */
export function resolveDataTableCheckboxConfig<TData, TIcon>(input: ResolveDataTableCheckboxInput<TData, TIcon>): ResolvedDataTableCheckboxConfig<TData, TIcon> {
	const { checkbox, labels, deleteSelectedIcon } = input;

	if (checkbox === undefined || checkbox === false) {
		return { enableBulkSelection: false, bulkActions: [], exportable: false, exportFormats: [] };
	}

	const checkboxConfig: DataTableCheckboxConfig<TData, TIcon> = checkbox === true ? {} : checkbox;
	const resolvedBulkActions: DataTableBulkAction<TData, TIcon>[] = [];

	const onDeleteAll = checkboxConfig.onDeleteAll;
	if (onDeleteAll !== undefined) {
		resolvedBulkActions.push({
			key: "delete-selected",
			label: labels.deleteSelected,
			icon: deleteSelectedIcon,
			variant: "destructive",
			onClick: (selectedRows, context): void | Promise<void> => onDeleteAll(selectedRows, context),
		});
	}

	if (checkboxConfig.bulkActions !== undefined) {
		resolvedBulkActions.push(...checkboxConfig.bulkActions);
	}

	const exportOption = checkboxConfig.export;

	return {
		enableBulkSelection: true,
		bulkActions: resolvedBulkActions,
		exportable: exportOption !== undefined && exportOption !== false,
		exportFormats: resolveExportFormats(exportOption),
		exportFilename: checkboxConfig.exportFilename,
		exportableColumns: checkboxConfig.exportableColumns,
	};
}

export { includesExportFormat };
