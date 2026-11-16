// DataTable row selection, bulk actions and export formats: shared with the native kit (@workspace/ui-kit-logic), with
// the web kit's glyphs (React nodes) bound in.

import type { RowData } from "@tanstack/react-table";
import type * as React from "react";
import {
	type DataTableBulkAction as SharedBulkAction,
	type DataTableCheckboxConfig as SharedCheckboxConfig,
	type ResolveDataTableCheckboxInput as SharedResolveInput,
	type ResolvedDataTableCheckboxConfig as SharedResolvedConfig,
} from "@workspace/ui-kit-logic";

export {
	DATA_TABLE_EXPORT_FORMATS,
	includesExportFormat,
	resolveDataTableCheckboxConfig,
	type DataTableBulkSelectionContext,
	type DataTableExportFormat,
} from "@workspace/ui-kit-logic";

export type DataTableBulkAction<TData extends RowData = RowData> = SharedBulkAction<TData, React.ReactNode>;
export type DataTableCheckboxConfig<TData extends RowData = RowData> = SharedCheckboxConfig<TData, React.ReactNode>;
export type ResolveDataTableCheckboxInput<TData extends RowData> = SharedResolveInput<TData, React.ReactNode>;
export type ResolvedDataTableCheckboxConfig<TData extends RowData> = SharedResolvedConfig<TData, React.ReactNode>;
