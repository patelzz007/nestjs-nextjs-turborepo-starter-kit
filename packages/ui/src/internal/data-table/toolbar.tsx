"use client";

// DataTable's toolbar: the search box, the filters, the caller's own controls, the live result count, and the menus
// at the end (export, columns). It holds no state: the table tells it every value and hears every change.

import { isArrayValue, isStringPrimitive } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { cn } from "@workspace/ui/lib/core/utils";
import { formatDataTableLabel, isDataTableDateRange, type DataTableFilterValue, type DataTableLabels, type TableEngineLabels } from "@workspace/ui-kit-logic";
import { Search, X } from "lucide-react";
import * as React from "react";

import { FilterDateRange } from "./filter-date-range";
import { FilterMultiSelect } from "./filter-multi-select";
import { FilterSelect } from "./filter-select";
import type { DataTableFilter, DataTableFilterChangeHandler, DataTableToolbarLayout } from "./props";

const NO_SELECTED_VALUES: readonly string[] = [];

/** A `select` filter's value out of whatever the table holds for it. */
function toSingleValue(value: DataTableFilterValue | null): string | null {
	return isStringPrimitive(value) ? value : null;
}

/** A `multi-select` filter's values out of whatever the table holds for it. */
function toMultiValue(value: DataTableFilterValue | null): readonly string[] {
	return isArrayValue(value) ? value : NO_SELECTED_VALUES;
}

/** The search box's state, or `null` for a table with no search. */
export interface ToolbarSearch {
	readonly value: string;
	readonly onChange: (value: string) => void;
	readonly onClear: () => void;
}

/** "12 of 240 results", shown while a search or a filter narrows a client-side table. */
export interface ToolbarResultCount {
	readonly filtered: number;
	readonly total: number;
}

export interface ToolbarProps {
	readonly layout: DataTableToolbarLayout;
	readonly search: ToolbarSearch | null;
	readonly filters: readonly DataTableFilter[];
	/** Each filter's current value, by its `column`. */
	readonly filterValues: Readonly<Record<string, DataTableFilterValue>>;
	/** How many rows have each option, by filter column; `null` on a server-paged table, which cannot count. */
	readonly filterCounts: Readonly<Record<string, ReadonlyMap<string, number>>> | null;
	/** How many rows the table shows with every filter applied. */
	readonly filteredCount: number;
	readonly resultCount: ToolbarResultCount | null;
	/** The caller's own controls (`toolbar.extra`). */
	readonly extra: React.ReactNode;
	/** The menus at the end of the row (export, columns). */
	readonly trailing: React.ReactNode;
	readonly labels: DataTableLabels;
	readonly engineLabels: TableEngineLabels;
	readonly onFilterChange: DataTableFilterChangeHandler;
}

export const Toolbar = React.memo(function Toolbar({
	layout,
	search,
	filters,
	filterValues,
	filterCounts,
	filteredCount,
	resultCount,
	extra,
	trailing,
	labels,
	engineLabels,
	onFilterChange,
}: ToolbarProps): React.JSX.Element | null {
	const onSearchChange = search?.onChange;
	const handleSearchChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onSearchChange?.(event.target.value);
		},
		[onSearchChange],
	);

	const isFill = layout === "fill";
	const hasFilters = filters.length > 0;
	const hasExtra = extra !== undefined && extra !== null;
	if (search === null && !hasFilters && !hasExtra && trailing === null) {
		return null;
	}

	// `fill`: from `sm` a grid of equal columns, one per control (the search, then each filter). A grid, not `flex-1`:
	// a flex item starts from its own padding, so padded filter buttons would come out wider than the search. On
	// phones the toolbar stays a flex column, where the template does nothing.
	const fillColumnCount = (search === null ? 0 : 1) + filters.length;

	return (
		<div
			data-slot="data-table-toolbar"
			data-layout={layout}
			className={cn("mb-3 flex flex-col gap-2 print:hidden", isFill ? "sm:grid sm:items-start" : "sm:flex-row sm:items-start")}
			style={isFill ? { gridTemplateColumns: `repeat(${String(Math.max(fillColumnCount, 1))}, minmax(0, 1fr))` } : undefined}>
			{search === null ? null : (
				<div className={cn("relative flex-1", isFill ? "sm:min-w-0" : "sm:w-64 sm:flex-none")}>
					<Search className="absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
					<Input
						aria-label={labels.searchAriaLabel}
						placeholder={labels.searchPlaceholder}
						value={search.value}
						onChange={handleSearchChange}
						className="h-9 ps-8 pe-8 text-sm"
					/>
					{search.value === "" ? null : (
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							onClick={search.onClear}
							aria-label={labels.clearSearchAriaLabel}
							className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
							<X className="size-4" aria-hidden="true" />
						</Button>
					)}
				</div>
			)}

			{/* Stacked on phones; from `sm` the filters wrap onto further lines when there are more than fit, so every
			    filter stays visible: no sideways scrolling, never clipped by the card around the table. They take the
			    space left over, but never less than their widest control (`min-w-min`). */}
			{hasFilters ? (
				<div
					data-slot="data-table-filters"
					// `fill`: the wrapper steps out of the layout (`contents`), so every filter is its own grid column.
					className={cn("flex flex-col gap-2", isFill ? "sm:contents" : "sm:min-w-min sm:flex-1 sm:flex-row sm:flex-wrap sm:items-center sm:*:shrink-0")}>
					{filters.map((filter) => {
						const value = filterValues[filter.column] ?? null;
						const counts = filterCounts === null ? null : (filterCounts[filter.column] ?? null);
						if (filter.kind === "date-range") {
							return (
								<FilterDateRange
									key={filter.column}
									filter={filter}
									value={isDataTableDateRange(value) ? value : null}
									labels={labels}
									onFilterChange={onFilterChange}
									fillWidth={isFill}
								/>
							);
						}
						return filter.kind === "select" ? (
							<FilterSelect
								key={filter.column}
								filter={filter}
								value={toSingleValue(value)}
								counts={counts}
								totalCount={filteredCount}
								labels={labels}
								onFilterChange={onFilterChange}
								fillWidth={isFill}
							/>
						) : (
							<FilterMultiSelect
								key={filter.column}
								filter={filter}
								value={toMultiValue(value)}
								counts={counts}
								labels={engineLabels}
								onFilterChange={onFilterChange}
								fillWidth={isFill}
							/>
						);
					})}
				</div>
			) : null}

			{extra}

			{resultCount === null ? null : (
				<span className="self-center text-xs whitespace-nowrap text-muted-foreground" aria-live="polite">
					{formatDataTableLabel(labels.resultsCount, { filtered: resultCount.filtered, total: resultCount.total })}
				</span>
			)}

			{trailing === null ? null : <div className="mt-1 flex items-center gap-2 sm:ms-auto sm:mt-0">{trailing}</div>}
		</div>
	);
});
