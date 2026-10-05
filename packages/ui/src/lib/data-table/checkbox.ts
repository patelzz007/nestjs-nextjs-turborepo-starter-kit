import type { RowData } from "@tanstack/react-table";
import type * as React from "react";
import { z } from "zod";

import type { DataTableLabels } from "@workspace/ui/lib/data-table/labels";

/** Supported export formats for the checkbox selection toolbar. */
export type DataTableExportFormat = "csv" | "json" | "pdf" | "xlsx";

export const DATA_TABLE_EXPORT_FORMATS: readonly DataTableExportFormat[] = ["csv", "json", "pdf", "xlsx"];

const exportFormatSchema = z.enum(["csv", "json", "pdf", "xlsx"]);

/** Selection scope passed to bulk actions (page selection vs all matching server rows). */
export interface DataTableBulkSelectionContext {
	readonly selectAllPages: boolean;
	readonly totalMatchingRows: number;
}

export interface DataTableBulkAction<TData extends RowData = RowData> {
	readonly key: string;
	readonly label: string;
	readonly icon?: React.ReactNode;
	readonly onClick: (selectedRows: TData[], context: DataTableBulkSelectionContext) => void | Promise<void>;
	readonly variant?: "default" | "destructive" | "outline";
}

/** Configuration for row checkboxes, bulk actions, and selection-aware export. */
export interface DataTableCheckboxConfig<TData extends RowData = RowData> {
	/** Extra bulk actions shown when one or more rows are selected. */
	readonly bulkActions?: DataTableBulkAction<TData>[];
	/** Adds a destructive bulk-delete action using `labels.deleteSelected`. */
	readonly onDeleteAll?: (selectedRows: TData[], context: DataTableBulkSelectionContext) => void | Promise<void>;
	/** Enable export (`true` = all formats) or pick specific formats. */
	readonly export?: boolean | readonly DataTableExportFormat[];
	readonly exportFilename?: string;
	readonly exportableColumns?: string[];
}

export interface ResolveDataTableCheckboxInput<TData extends RowData> {
	readonly checkbox?: boolean | DataTableCheckboxConfig<TData> | undefined;
	readonly labels: DataTableLabels;
	readonly deleteSelectedIcon: React.ReactNode;
}

export interface ResolvedDataTableCheckboxConfig<TData extends RowData> {
	readonly enableBulkSelection: boolean;
	readonly bulkActions: DataTableBulkAction<TData>[];
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
	if (Array.isArray(exportOption)) {
		return exportOption.filter((format): format is DataTableExportFormat => exportFormatSchema.safeParse(format).success);
	}
	return [];
}

/** Normalises the `checkbox` prop into one selection / bulk-action / export config. */
export function resolveDataTableCheckboxConfig<TData extends RowData>(input: ResolveDataTableCheckboxInput<TData>): ResolvedDataTableCheckboxConfig<TData> {
	const { checkbox, labels, deleteSelectedIcon } = input;

	if (checkbox === undefined || checkbox === false) {
		return { enableBulkSelection: false, bulkActions: [], exportable: false, exportFormats: [] };
	}

	const checkboxConfig: DataTableCheckboxConfig<TData> = checkbox === true ? {} : checkbox;
	const resolvedBulkActions: DataTableBulkAction<TData>[] = [];

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
