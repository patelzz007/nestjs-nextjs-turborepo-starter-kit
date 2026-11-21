"use client";

// A toolbar filter that picks ANY NUMBER of options from a searchable list. Controlled: the table holds the value.
// The option list, its search and its toggling follow the engine's column filter (the helpers are shared).

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { Separator } from "@workspace/ui/components/separator";
import { cn } from "@workspace/ui/lib/core/utils";
import type { TableEngineLabels } from "@workspace/ui-kit-logic";
import type { CellData, Row, RowData } from "@tanstack/react-table";
import { cva } from "class-variance-authority";
import { CheckIcon, CirclePlusIcon } from "lucide-react";
import * as React from "react";

import type { TableEngineFeatures } from "../table-engine/table-engine";
import { readTableEngineColumnFilterValues, toggleTableEngineColumnFilterValue } from "../table-engine/table-engine-column-filter";
import type { DataTableFilterChangeHandler, DataTableFilterOption, DataTableMultiSelectFilter } from "./props";

/** Up to this many chosen options are listed by name on the trigger; more collapse into a count. */
const MAX_NAMED_SELECTED_OPTIONS = 2;

/**
 * The client-side `filterFn` of a column with a multi-select filter: a row passes when its value is one of the chosen
 * options. The table sets it on the column itself; a column may still declare its own.
 */
export function multiSelectFilterFn<TData extends RowData>(row: Row<TableEngineFeatures, TData>, columnId: string, filterValue: CellData): boolean {
	const selected = readTableEngineColumnFilterValues(filterValue);
	return selected.length === 0 || selected.includes(String(row.getValue(columnId)));
}

/** The options whose label contains the search text (case-insensitive). */
export function searchFilterOptions(options: readonly DataTableFilterOption[], query: string): readonly DataTableFilterOption[] {
	if (query === "") {
		return options;
	}
	const needle = query.toLowerCase();
	return options.filter((option) => option.label.toLowerCase().includes(needle));
}

const optionRowVariants = cva(
	"relative flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-start text-sm outline-hidden select-none hover:bg-foreground/10 focus-visible:bg-foreground/10",
	{
		variants: { state: { default: "", selected: "font-medium" } },
		defaultVariants: { state: "default" },
	},
);

const optionCheckVariants = cva("flex size-4 shrink-0 items-center justify-center rounded-sm border border-primary", {
	variants: { state: { default: "opacity-50 [&_svg]:invisible", selected: "bg-primary text-primary-foreground" } },
	defaultVariants: { state: "default" },
});

interface OptionRowProps {
	readonly option: DataTableFilterOption;
	readonly selected: boolean;
	readonly count: number | undefined;
	readonly onToggle: (value: string) => void;
}

const OptionRow = React.memo(function OptionRow({ option, selected, count, onToggle }: OptionRowProps): React.JSX.Element {
	const state = selected ? "selected" : "default";
	const handleClick = React.useCallback((): void => {
		onToggle(option.value);
	}, [onToggle, option.value]);
	return (
		<button type="button" aria-pressed={selected} data-slot="data-table-filter-option" className={optionRowVariants({ state })} onClick={handleClick}>
			<span aria-hidden="true" className={optionCheckVariants({ state })}>
				<CheckIcon className="size-4" />
			</span>
			{option.icon === undefined ? null : (
				<span aria-hidden="true" className="flex shrink-0 text-muted-foreground [&_svg]:size-4">
					{option.icon}
				</span>
			)}
			<span className="truncate">{option.label}</span>
			{count === undefined ? null : <span className="ms-auto font-mono text-xs text-muted-foreground">{count}</span>}
		</button>
	);
});

export interface FilterMultiSelectProps {
	readonly filter: DataTableMultiSelectFilter;
	/** The chosen option values. */
	readonly value: readonly string[];
	/** How many rows have each option, by option value; `null` on a server-paged table, which cannot count. */
	readonly counts: ReadonlyMap<string, number> | null;
	readonly labels: TableEngineLabels;
	readonly onFilterChange: DataTableFilterChangeHandler;
	/** Fill the cell the toolbar gives it (the `fill` layout). */
	readonly fillWidth?: boolean;
}

export const FilterMultiSelect = React.memo(function FilterMultiSelect({
	filter,
	value,
	counts,
	labels,
	onFilterChange,
	fillWidth = false,
}: FilterMultiSelectProps): React.JSX.Element {
	const [searchQuery, setSearchQuery] = React.useState("");
	const visibleOptions = React.useMemo((): readonly DataTableFilterOption[] => searchFilterOptions(filter.options, searchQuery), [filter.options, searchQuery]);

	const handleSearchChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setSearchQuery(event.target.value);
	}, []);
	const handleToggle = React.useCallback(
		(optionValue: string): void => {
			onFilterChange(filter.column, toggleTableEngineColumnFilterValue(value, optionValue) ?? null);
		},
		[filter.column, onFilterChange, value],
	);
	const handleClear = React.useCallback((): void => {
		onFilterChange(filter.column, null);
	}, [filter.column, onFilterChange]);

	const selectedCount = value.length;
	const selectedOptions = filter.options.filter((option) => value.includes(option.value));

	return (
		<Popover>
			<PopoverTrigger
				render={
					<Button variant="outline" size="sm" className={cn("h-9 justify-start", fillWidth ? "w-full sm:min-w-0" : undefined)}>
						<CirclePlusIcon aria-hidden="true" className="size-4" />
						{filter.label}
						{selectedCount > 0 ? (
							<>
								<Separator orientation="vertical" className="mx-2 h-4" />
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
							</>
						) : null}
					</Button>
				}
			/>
			<PopoverContent className="w-56 gap-0 p-0" align="start">
				<div className="p-2">
					<Input placeholder={filter.label} aria-label={filter.label} value={searchQuery} onChange={handleSearchChange} className="h-8" />
				</div>
				<div className="max-h-72 overflow-y-auto">
					{visibleOptions.length === 0 ? (
						<div className="py-6 text-center text-sm text-muted-foreground">{labels.filterNoResults}</div>
					) : (
						<div className="p-1">
							{visibleOptions.map((option) => (
								<OptionRow key={option.value} option={option} selected={value.includes(option.value)} count={counts?.get(option.value)} onToggle={handleToggle} />
							))}
						</div>
					)}
					{selectedCount > 0 ? (
						<>
							<Separator />
							<div className="p-1">
								<button type="button" className={cn(optionRowVariants(), "justify-center")} onClick={handleClear}>
									{labels.filterClear}
								</button>
							</div>
						</>
					) : null}
				</div>
			</PopoverContent>
		</Popover>
	);
});
