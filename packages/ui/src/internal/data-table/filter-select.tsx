"use client";

// A toolbar filter that picks ONE option, or "All". Controlled: the table holds the value.

import { Select, SelectContent, SelectItem, type SelectOption, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { cn } from "@workspace/ui/lib/core/utils";
import { formatDataTableLabel, type DataTableLabels } from "@workspace/ui-kit-logic";
import { ListFilter } from "lucide-react";
import * as React from "react";

import type { DataTableFilterChangeHandler, DataTableSelectFilter } from "./props";
import { FILTER_ALL_VALUE } from "./shared";

export interface FilterSelectProps {
	readonly filter: DataTableSelectFilter;
	/** The chosen option's value, or `null` for "All". */
	readonly value: string | null;
	/**
	 * How many rows have each option, by option value. Counts are only true on a client-side table, which holds every
	 * row; a server-paged table holds one page, so it passes `null` and the options show no counts.
	 */
	readonly counts: ReadonlyMap<string, number> | null;
	/** How many rows the table shows with every filter applied: the "All" choice's count. */
	readonly totalCount: number;
	readonly labels: DataTableLabels;
	readonly onFilterChange: DataTableFilterChangeHandler;
	/** Fill the cell the toolbar gives it (the `fill` layout) instead of sizing to the label. */
	readonly fillWidth?: boolean;
}

export const FilterSelect = React.memo(function FilterSelect({
	filter,
	value,
	counts,
	totalCount,
	labels,
	onFilterChange,
	fillWidth = false,
}: FilterSelectProps): React.JSX.Element {
	const handleValueChange = React.useCallback(
		(next: string | null): void => {
			onFilterChange(filter.column, next === null || next === FILTER_ALL_VALUE ? null : next);
		},
		[filter.column, onFilterChange],
	);

	// One option list feeds both the Root's `items` (the closed trigger's label) and the rendered items, so the
	// trigger always shows exactly the selected item's text, count included.
	const options = React.useMemo((): readonly SelectOption<string>[] => {
		const withCount = (label: string, count: number | undefined): string => (count === undefined ? label : formatDataTableLabel(labels.filterOptionCount, { label, count }));
		return [
			{ value: FILTER_ALL_VALUE, label: withCount(labels.filterAll, counts === null ? undefined : totalCount) },
			...filter.options.map((option): SelectOption<string> => ({ value: option.value, label: withCount(option.label, counts?.get(option.value)) })),
		];
	}, [counts, filter.options, labels.filterAll, labels.filterOptionCount, totalCount]);

	// Icons are opt-in per option; "All" gets one only when the others do, so the labels line up.
	const icons = React.useMemo((): ReadonlyMap<string, React.ReactNode> => {
		const byValue = new Map<string, React.ReactNode>();
		for (const option of filter.options) {
			if (option.icon !== undefined) {
				byValue.set(option.value, option.icon);
			}
		}
		if (byValue.size > 0) {
			byValue.set(FILTER_ALL_VALUE, <ListFilter />);
		}
		return byValue;
	}, [filter.options]);

	const nameId = React.useId();

	// The filter's name stays visible in front of its choice ("Source: All"), so a row of dropdowns never reads as a
	// row of identical "All"s. That visible text is also its accessible name (WCAG 2.5.3): a combobox takes no name
	// from its content, and an `aria-label` of the name alone would leave out the choice it shows.
	return (
		<Select<string> value={value ?? FILTER_ALL_VALUE} onValueChange={handleValueChange} items={options}>
			<SelectTrigger className={cn("h-9 w-full text-sm", fillWidth ? "sm:min-w-0" : "sm:w-auto sm:min-w-44")} aria-labelledby={nameId}>
				<span id={nameId} className="flex min-w-0 items-center gap-1.5">
					<span className="shrink-0 text-muted-foreground" data-slot="filter-label">
						{filter.label}:
					</span>
					<SelectValue placeholder={filter.label} className="truncate font-medium" />
				</span>
			</SelectTrigger>
			<SelectContent>
				{options.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{icons.has(option.value) ? (
							<span className="flex min-w-0 items-center gap-2">
								<span aria-hidden="true" data-slot="filter-option-icon" className="flex shrink-0 opacity-70">
									{icons.get(option.value)}
								</span>
								<span className="truncate">{option.label}</span>
							</span>
						) : (
							option.label
						)}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
});
