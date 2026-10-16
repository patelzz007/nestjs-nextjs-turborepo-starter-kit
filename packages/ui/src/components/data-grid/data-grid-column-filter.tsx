"use client";

// A faceted multi-select column filter: a popover listing the consumer's
// options with their faceted counts, a search box, and a clear action. The
// filter value it writes is the array of selected option values (pair the
// column with `filterFn: dataGridColumnFilterFn`).

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { useDataGrid, type DataGridFeatures } from "@workspace/ui/components/data-grid/data-grid";
import { Input } from "@workspace/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { Separator } from "@workspace/ui/components/separator";
import { cn } from "@workspace/ui/lib/core/utils";
import type { CellData, Column, Row, RowData } from "@tanstack/react-table";
import { cva } from "class-variance-authority";
import { CheckIcon, CirclePlusIcon } from "lucide-react";
import * as React from "react";
import { z } from "zod";

export interface DataGridColumnFilterOption {
	readonly label: string;
	readonly value: string;
	readonly icon?: React.ComponentType<{ readonly className?: string }>;
}

export interface DataGridColumnFilterProps<TData extends RowData, TValue extends CellData> {
	/** The filtered column; without one the control renders inert. */
	readonly column?: Column<DataGridFeatures, TData, TValue> | undefined;
	/** Trigger text and the search box's placeholder / accessible name. */
	readonly title?: string;
	readonly options: readonly DataGridColumnFilterOption[];
	/** Ref to the trigger button (React 19 ref prop — a generic `forwardRef` would erase `TData`). */
	readonly ref?: React.Ref<HTMLButtonElement>;
}

/** The filter value this control writes: the selected option values. */
const FilterValuesSchema = z.array(z.string());

/** Up to this many selected options are listed by name on the trigger; more collapse into a count. */
const MAX_NAMED_SELECTED_OPTIONS = 2;

const EMPTY_SELECTION: readonly string[] = [];

/** The selected values in the column's current filter (anything else selects nothing). */
export function readDataGridColumnFilterValues(filterValue: CellData): readonly string[] {
	const parsed = FilterValuesSchema.safeParse(filterValue);
	return parsed.success ? parsed.data : EMPTY_SELECTION;
}

/**
 * The `filterFn` this control pairs with: a row passes when its value is one
 * of the selected option values (`filterFn: dataGridColumnFilterFn`).
 */
export function dataGridColumnFilterFn<TData extends RowData>(row: Row<DataGridFeatures, TData>, columnId: string, filterValue: CellData): boolean {
	const selected = readDataGridColumnFilterValues(filterValue);
	return selected.length === 0 || selected.includes(String(row.getValue(columnId)));
}

/** The next filter value after toggling `value`; `undefined` clears the filter. */
export function toggleDataGridColumnFilterValue(selected: readonly string[], value: string): string[] | undefined {
	const next = selected.includes(value) ? selected.filter((selectedValue) => selectedValue !== value) : [...selected, value];
	return next.length > 0 ? next : undefined;
}

/** The options whose label contains the search query (case-insensitive). */
export function filterDataGridColumnFilterOptions(options: readonly DataGridColumnFilterOption[], query: string): readonly DataGridColumnFilterOption[] {
	if (query === "") {
		return options;
	}
	const needle = query.toLowerCase();
	return options.filter((option) => option.label.toLowerCase().includes(needle));
}

const filterOptionVariants = cva(
	"relative flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-start text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground",
	{
		variants: {
			state: {
				default: "",
				selected: "font-medium",
			},
		},
		defaultVariants: { state: "default" },
	},
);

const filterCheckVariants = cva("flex size-4 items-center justify-center rounded-sm border border-primary", {
	variants: {
		state: {
			default: "opacity-50 [&_svg]:invisible",
			selected: "bg-primary text-primary-foreground",
		},
	},
	defaultVariants: { state: "default" },
});

interface FilterOptionRowProps {
	readonly option: DataGridColumnFilterOption;
	readonly selected: boolean;
	readonly count: number | undefined;
	readonly onToggle: (value: string) => void;
}

function FilterOptionRow({ option, selected, count, onToggle }: FilterOptionRowProps): React.JSX.Element {
	const state = selected ? "selected" : "default";
	const handleClick = React.useCallback((): void => {
		onToggle(option.value);
	}, [onToggle, option.value]);
	const Icon = option.icon;
	return (
		<button type="button" aria-pressed={selected} data-slot="data-grid-column-filter-option" className={filterOptionVariants({ state })} onClick={handleClick}>
			<span aria-hidden="true" className={filterCheckVariants({ state })}>
				<CheckIcon className="size-4" />
			</span>
			{Icon === undefined ? null : <Icon className="size-4 text-muted-foreground" />}
			<span>{option.label}</span> {count === undefined ? null : <span className="ms-auto flex size-4 items-center justify-center font-mono text-xs">{count}</span>}
		</button>
	);
}

/** A faceted multi-select filter for one column. */
export function DataGridColumnFilter<TData extends RowData, TValue extends CellData>({
	column,
	title,
	options,
	ref,
}: DataGridColumnFilterProps<TData, TValue>): React.JSX.Element {
	const { labels } = useDataGrid();
	const facets = column?.getFacetedUniqueValues();
	const selectedValues = readDataGridColumnFilterValues(column?.getFilterValue());
	const [searchQuery, setSearchQuery] = React.useState("");
	const filteredOptions = React.useMemo((): readonly DataGridColumnFilterOption[] => filterDataGridColumnFilterOptions(options, searchQuery), [options, searchQuery]);

	const handleSearchChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setSearchQuery(event.target.value);
	}, []);
	const handleToggle = React.useCallback(
		(value: string): void => {
			column?.setFilterValue(toggleDataGridColumnFilterValue(readDataGridColumnFilterValues(column.getFilterValue()), value));
		},
		[column],
	);
	const handleClear = React.useCallback((): void => {
		column?.setFilterValue(undefined);
	}, [column]);

	const selectedCount = selectedValues.length;
	const selectedOptions = options.filter((option) => selectedValues.includes(option.value));

	return (
		<Popover>
			<PopoverTrigger
				ref={ref}
				render={
					<Button variant="outline" size="sm">
						<CirclePlusIcon aria-hidden="true" className="size-4" />
						{title}
						{selectedCount > 0 ? (
							<>
								<Separator orientation="vertical" className="mx-2 h-4" />
								<Badge variant="secondary" className="px-1 font-normal lg:hidden">
									{selectedCount}
								</Badge>
								<span className="hidden gap-x-1 lg:flex">
									{selectedCount > MAX_NAMED_SELECTED_OPTIONS ? (
										<Badge variant="secondary" className="px-1 font-normal">
											{labels.filterSelectedCount(selectedCount)}
										</Badge>
									) : (
										selectedOptions.map((option) => (
											<Badge variant="secondary" key={option.value} className="px-1 font-normal">
												{option.label}
											</Badge>
										))
									)}
								</span>
							</>
						) : null}
					</Button>
				}
			/>
			<PopoverContent className="w-52 gap-0 p-0" align="start">
				<div className="p-2">
					<Input placeholder={title} aria-label={title} value={searchQuery} onChange={handleSearchChange} className="h-8" />
				</div>
				<div className="max-h-72 overflow-y-auto">
					{filteredOptions.length === 0 ? (
						<div className="py-6 text-center text-sm text-muted-foreground">{labels.filterNoResults}</div>
					) : (
						<div className="p-1">
							{filteredOptions.map((option) => (
								<FilterOptionRow
									key={option.value}
									option={option}
									selected={selectedValues.includes(option.value)}
									count={facets?.get(option.value)}
									onToggle={handleToggle}
								/>
							))}
						</div>
					)}
					{selectedCount > 0 ? (
						<>
							<Separator />
							<div className="p-1">
								<button type="button" className={cn(filterOptionVariants(), "justify-center")} onClick={handleClear}>
									{labels.filterClear}
								</button>
							</div>
						</>
					) : null}
				</div>
			</PopoverContent>
		</Popover>
	);
}
