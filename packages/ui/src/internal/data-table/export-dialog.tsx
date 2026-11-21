"use client";

// DataTable's export dialog (`exporting.mode: "dialog"`): the reader picks the format, which rows go out (the ticked
// ones, every row that matches the filters, or every row) and which columns, and sees how many rows that is before
// the file is written. The files are the same ones the export menu writes.

import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog";
import { Label } from "@workspace/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import {
	DATA_TABLE_EXPORT_FORMATS,
	DataTableExportFormatSchema,
	formatDataTableLabel,
	resolveDataTableColumnId,
	type DataTableExportFormat,
	type DataTableLabels,
} from "@workspace/ui-kit-logic";
import { Subscribe, type RowData } from "@tanstack/react-table";
import { FileDown } from "lucide-react";
import * as React from "react";
import { z } from "zod";

import { getColumnHeaderLabel } from "../table-engine/table-engine";
import { EXPORT_FORMAT_OPTIONS, pickExportColumns, resolveExportColumns, type ExportColumnChoice } from "./export-menu";
import type { DataTableColumns, DataTableExporting } from "./props";
import { memoGeneric, TOOLBAR_MENU_TRIGGER_CLASS_NAME, type DataTableInstance } from "./shared";

/** Which rows an export from the dialog covers. */
export const ExportScopeSchema = z.enum(["selected", "matching", "all"]);
export type ExportScope = z.output<typeof ExportScopeSchema>;

/** How many rows each scope covers, and whether it can be picked. `all` is `null` on a server table, which never holds every row. */
export interface ExportScopeCounts {
	readonly selected: number;
	readonly matching: number;
	readonly all: number | null;
}

/** The scope a dialog opens on: the ticked rows when there are any, otherwise every matching row. */
export function defaultExportScope(counts: ExportScopeCounts): ExportScope {
	return counts.selected > 0 ? "selected" : "matching";
}

/**
 * The rows a scope covers. `flatRows`, so a tree's child rows go out too. "Every matching row" on a server table is
 * fetched from the server when the caller can (`onFetchAllMatching`); without that, it is the page on screen.
 */
export function resolveExportScopeRows<TData extends RowData>(
	table: DataTableInstance<TData>,
	scope: ExportScope,
	onFetchAllMatching: (() => Promise<TData[]>) | undefined,
): Promise<TData[]> {
	if (scope === "selected") {
		return Promise.resolve(table.getSelectedRowModel().flatRows.map((row) => row.original));
	}
	if (scope === "all") {
		return Promise.resolve(table.getCoreRowModel().flatRows.map((row) => row.original));
	}
	if (onFetchAllMatching !== undefined) {
		return onFetchAllMatching();
	}
	return Promise.resolve(table.getFilteredRowModel().flatRows.map((row) => row.original));
}

interface ColumnToggleProps {
	readonly id: string;
	readonly title: string;
	readonly checked: boolean;
	readonly onToggle: (id: string, checked: boolean) => void;
}

/** One column's tick in the dialog's column list. */
const ColumnToggle = React.memo(function ColumnToggle({ id, title, checked, onToggle }: ColumnToggleProps): React.JSX.Element {
	const handleCheckedChange = React.useCallback(
		(next: boolean): void => {
			onToggle(id, next);
		},
		[id, onToggle],
	);
	return (
		<Label className="flex items-center gap-2 font-normal">
			<Checkbox checked={checked} onCheckedChange={handleCheckedChange} />
			{title}
		</Label>
	);
});

/** How many rows each scope covers, read from the table as it is now. */
export function readExportScopeCounts<TData extends RowData>(table: DataTableInstance<TData>, isServer: boolean, matchingCount: number): ExportScopeCounts {
	return {
		selected: table.getSelectedRowModel().flatRows.length,
		// A server table counts what the server says matches; a client table counts every matching row, tree children included.
		matching: isServer ? matchingCount : table.getFilteredRowModel().flatRows.length,
		all: isServer ? null : table.getCoreRowModel().flatRows.length,
	};
}

export interface ExportDialogProps<TData extends RowData> {
	readonly table: DataTableInstance<TData>;
	/** The table's column definitions, utility columns included (they are left out here). */
	readonly columns: DataTableColumns<TData>;
	readonly exporting: DataTableExporting<TData>;
	/** A server table: "every row" is not offered, and the matching count is the server's. */
	readonly isServer: boolean;
	/** How many rows match the search and the filters, across every page. */
	readonly matchingCount: number;
	readonly labels: DataTableLabels;
	readonly onFetchAllMatching: (() => Promise<TData[]>) | undefined;
}

/** The dialog, kept in step with the selection (the ticked-rows count) without the toolbar around it re-rendering. */
export const ExportDialog = memoGeneric(function ExportDialog<TData extends RowData>(props: ExportDialogProps<TData>): React.JSX.Element {
	const { table, isServer, matchingCount } = props;
	return <Subscribe source={table.atoms.rowSelection}>{() => <ExportDialogBody {...props} counts={readExportScopeCounts(table, isServer, matchingCount)} />}</Subscribe>;
});

interface ExportDialogBodyProps<TData extends RowData> extends ExportDialogProps<TData> {
	readonly counts: ExportScopeCounts;
}

const ExportDialogBody = memoGeneric(function ExportDialogBody<TData extends RowData>({
	table,
	columns,
	exporting,
	counts,
	labels,
	onFetchAllMatching,
}: ExportDialogBodyProps<TData>): React.JSX.Element {
	const formats = exporting.formats ?? DATA_TABLE_EXPORT_FORMATS;
	const formatOptions = EXPORT_FORMAT_OPTIONS.filter((option) => formats.includes(option.format));
	const choice = React.useMemo((): ExportColumnChoice<TData> => resolveExportColumns(columns, exporting.keys), [columns, exporting.keys]);
	const startColumns = choice.initial;
	// The ids the table has a column for: a row field without one is titled by its key.
	const tableColumnIds = React.useMemo((): ReadonlySet<string> => new Set(columns.flatMap((column) => resolveDataTableColumnId(column) ?? [])), [columns]);

	const [open, setOpen] = React.useState(false);
	const [format, setFormat] = React.useState<DataTableExportFormat>(() => formatOptions.at(0)?.format ?? "csv");
	const [scope, setScope] = React.useState<ExportScope>("matching");
	const [chosenColumns, setChosenColumns] = React.useState<readonly string[]>(startColumns);

	// Opening starts from the table as it is now: the ticked rows (if any) and the caller's starting columns.
	const handleOpenChange = React.useCallback(
		(next: boolean): void => {
			if (next) {
				setScope(defaultExportScope(counts));
				setChosenColumns(startColumns);
			}
			setOpen(next);
		},
		[counts, startColumns],
	);

	const handleFormatChange = React.useCallback((value: string): void => {
		const next = DataTableExportFormatSchema.safeParse(value);
		if (next.success) {
			setFormat(next.data);
		}
	}, []);
	const handleScopeChange = React.useCallback((value: string): void => {
		const next = ExportScopeSchema.safeParse(value);
		if (next.success) {
			setScope(next.data);
		}
	}, []);
	const handleColumnToggle = React.useCallback((id: string, checked: boolean): void => {
		setChosenColumns((current) => (checked ? [...current.filter((entry) => entry !== id), id] : current.filter((entry) => entry !== id)));
	}, []);

	const rowCount = scope === "selected" ? counts.selected : scope === "all" ? (counts.all ?? 0) : counts.matching;
	const canExport = rowCount > 0 && chosenColumns.length > 0;

	const handleExport = React.useCallback((): void => {
		const option = EXPORT_FORMAT_OPTIONS.find((candidate) => candidate.format === format);
		if (option === undefined) {
			return;
		}
		// The columns in the dialog's order, not the order they were ticked in.
		const exportColumns = pickExportColumns(choice, chosenColumns);
		void resolveExportScopeRows(table, scope, onFetchAllMatching).then((rows) => {
			option.exportRows(rows, exportColumns, option.resolveFilename(exporting.filename));
		});
		setOpen(false);
	}, [format, choice, chosenColumns, table, scope, onFetchAllMatching, exporting.filename]);

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger className={TOOLBAR_MENU_TRIGGER_CLASS_NAME}>
				<FileDown className="size-4" aria-hidden="true" />
				<span>{labels.export}</span>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{labels.exportDialogTitle}</DialogTitle>
				</DialogHeader>

				<fieldset className="flex flex-col gap-2">
					<legend className="mb-2 text-sm font-medium">{labels.exportDialogFormat}</legend>
					<RadioGroup value={format} onValueChange={handleFormatChange} aria-label={labels.exportDialogFormat}>
						{formatOptions.map((option) => (
							<Label key={option.format} className="flex items-center gap-2 font-normal">
								<RadioGroupItem value={option.format} />
								{labels[option.labelKey]}
							</Label>
						))}
					</RadioGroup>
				</fieldset>

				<fieldset className="flex flex-col gap-2">
					<legend className="mb-2 text-sm font-medium">{labels.exportDialogRows}</legend>
					<RadioGroup value={scope} onValueChange={handleScopeChange} aria-label={labels.exportDialogRows}>
						<Label className="flex items-center gap-2 font-normal">
							<RadioGroupItem value="selected" disabled={counts.selected === 0} />
							{formatDataTableLabel(labels.exportScopeSelected, { count: counts.selected })}
						</Label>
						<Label className="flex items-center gap-2 font-normal">
							<RadioGroupItem value="matching" />
							{formatDataTableLabel(labels.exportScopeMatching, { count: counts.matching })}
						</Label>
						{counts.all === null ? null : (
							<Label className="flex items-center gap-2 font-normal">
								<RadioGroupItem value="all" />
								{formatDataTableLabel(labels.exportScopeAll, { count: counts.all })}
							</Label>
						)}
					</RadioGroup>
				</fieldset>

				<fieldset className="flex flex-col gap-2">
					<legend className="mb-2 text-sm font-medium">{labels.exportDialogColumns}</legend>
					<div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto">
						{choice.available.map((columnDef) => {
							const id = resolveDataTableColumnId(columnDef) ?? "";
							const column = tableColumnIds.has(id) ? table.getColumn(id) : undefined;
							return (
								<ColumnToggle
									key={id}
									id={id}
									title={column === undefined ? id : getColumnHeaderLabel(column)}
									checked={chosenColumns.includes(id)}
									onToggle={handleColumnToggle}
								/>
							);
						})}
					</div>
				</fieldset>

				<DialogFooter>
					<DialogClose render={<Button variant="outline" />}>{labels.exportDialogCancel}</DialogClose>
					<Button disabled={!canExport} onClick={handleExport}>
						<FileDown aria-hidden="true" />
						{formatDataTableLabel(labels.exportDialogConfirm, { count: rowCount })}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
});
