"use client";

import { Button } from "@workspace/ui/components/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@workspace/ui/components/command";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { cn } from "@workspace/ui/lib/core/utils";
import { ChevronLeftIcon, ChevronRightIcon, ListFilterPlusIcon } from "lucide-react";
import * as React from "react";

import { filterControlSizes, filterReadOnlyProps, useFilterActions, useFilterState } from "./filters-context";
import {
	FILTER_FIELD_PICKER_CLASS,
	formatFilterPath,
	getFilterChildren,
	getFilterFieldCount,
	isFilterBranch,
	isFilterFieldPickable,
	joinFilterPath,
	normalizeFilterQuery,
	searchFilterDeep,
} from "./filters-lib";
import { getDefaultFilterOperator } from "./filters-operators";
import type { FilterField, FilterIndexEntry, FilterLabels } from "./filters-types";

/** A pinned footer row of the field picker, OUT of the option ring. */
export interface FilterFieldPickerAction {
	readonly value: string;
	readonly label: string;
	readonly onSelect: () => void;
	readonly disabled?: boolean | undefined;
}

/** The picker's list height before it scrolls, in pixels. */
export const FILTER_FIELD_PICKER_MAX_HEIGHT = 260;

export interface FilterFieldPickerProps {
	/** The level being browsed. Not the chosen field. */
	readonly path: readonly string[];
	readonly onPathChange: (path: readonly string[]) => void;
	readonly query: string;
	readonly onQueryChange: (query: string) => void;
	/** A field was chosen, with its starting operator already resolved. */
	readonly onSelect: (path: readonly string[], defaultOperator: string | null) => void;
	/** Viewport height before the list scrolls. */
	readonly maxHeight?: number | undefined;
	/** Per-picker overrides of the filters copy. */
	readonly labels?: Partial<FilterLabels> | undefined;
	/** Pinned footer rows, OUT of the option ring so arrows never land on one. */
	readonly actions?: readonly FilterFieldPickerAction[] | undefined;
	readonly className?: string | undefined;
}

interface PickerRow {
	readonly field: FilterField;
	readonly path: readonly string[];
	/** The ancestors, as words, for a deep-search result. */
	readonly context: string;
}

interface FieldPickerRowProps {
	readonly row: PickerRow;
	readonly labels: FilterLabels;
	readonly onBranch: (path: readonly string[]) => void;
	readonly onLeaf: (row: PickerRow) => void;
}

const FieldPickerRow = React.memo(function FieldPickerRow({ row, labels, onBranch, onLeaf }: FieldPickerRowProps): React.JSX.Element {
	const branch = isFilterBranch(row.field);
	const handleSelect = React.useCallback((): void => {
		if (branch) {
			onBranch(row.path);
			return;
		}
		onLeaf(row);
	}, [branch, onBranch, onLeaf, row]);
	const count = getFilterFieldCount(row.field);
	return (
		<CommandItem
			value={joinFilterPath(row.path)}
			disabled={row.field.disabled === true || (!branch && !isFilterFieldPickable(row.field))}
			onSelect={handleSelect}
			data-branch={branch ? "" : undefined}
			className="px-2 py-1.5">
			{row.field.icon === undefined || row.field.icon === null ? null : <span className="flex shrink-0 items-center text-muted-foreground">{row.field.icon}</span>}
			<span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
				<span className="w-full truncate text-start">{row.field.label}</span>
				{row.context === "" ? null : <span className="w-full truncate text-start text-xs text-muted-foreground">{row.context}</span>}
			</span>
			{branch ? (
				<>
					<span aria-hidden="true" className="ms-auto text-xs text-muted-foreground tabular-nums">
						{count}
					</span>
					<ChevronRightIcon aria-hidden="true" className="text-muted-foreground rtl:rotate-180" />
					<span className="sr-only">{`, ${labels.itemCount(count)}, ${labels.branchAffordance}`}</span>
				</>
			) : null}
		</CommandItem>
	);
});

/**
 * The attribute picker: one level at a time, branches drill in, leaves commit,
 * and typing searches every pickable field at any depth. Fully controlled, so
 * ONE picker serves both the Add filter popover (driven by the draft reducer)
 * and an advanced row (its own state).
 */
export const FilterFieldPicker = React.forwardRef<HTMLDivElement, FilterFieldPickerProps>(function FilterFieldPicker(
	{ path, onPathChange, query, onQueryChange, onSelect, maxHeight = FILTER_FIELD_PICKER_MAX_HEIGHT, labels: labelsOverride, actions: footerActions, className },
	ref,
): React.JSX.Element {
	const actions = useFilterActions();
	const labels = React.useMemo(
		(): FilterLabels => (labelsOverride === undefined ? actions.labels : { ...actions.labels, ...labelsOverride }),
		[actions.labels, labelsOverride],
	);
	const normalizedQuery = normalizeFilterQuery(query);

	const rows = React.useMemo((): readonly PickerRow[] => {
		if (normalizedQuery !== "") {
			return searchFilterDeep(actions.index, normalizedQuery).map((entry: FilterIndexEntry): PickerRow => ({
				field: entry.field,
				path: entry.path,
				context: entry.path.length > 1 ? formatFilterPath(actions.index, entry.path.slice(0, -1), labels.pathSeparator) : "",
			}));
		}
		return getFilterChildren(actions.index, path).map((field: FilterField): PickerRow => ({ field, path: [...path, field.id], context: "" }));
	}, [actions.index, normalizedQuery, path, labels.pathSeparator]);

	const handleBranch = React.useCallback(
		(next: readonly string[]): void => {
			onPathChange(next);
			onQueryChange("");
		},
		[onPathChange, onQueryChange],
	);

	const handleLeaf = React.useCallback(
		(row: PickerRow): void => {
			onSelect(row.path, getDefaultFilterOperator(row.field, actions.resolveOperators(row.field)));
		},
		[onSelect, actions],
	);

	const handleBack = React.useCallback((): void => {
		onPathChange(path.slice(0, -1));
	}, [onPathChange, path]);

	const handleInputKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>): void => {
			// Backspace on an empty search climbs a level, the keyboard's Back.
			if (event.key === "Backspace" && query === "" && path.length > 0) {
				event.preventDefault();
				onPathChange(path.slice(0, -1));
			}
		},
		[query, path, onPathChange],
	);

	const listStyle = React.useMemo((): React.CSSProperties => ({ maxHeight }), [maxHeight]);
	const browsing = normalizedQuery === "" && path.length > 0;

	return (
		<Command ref={ref} data-slot="filter-field-picker" shouldFilter={false} loop label={labels.fieldsLabel} className={cn("rounded-none! bg-transparent p-0", className)}>
			<CommandInput value={query} onValueChange={onQueryChange} placeholder={labels.searchFields} aria-label={labels.searchFields} onKeyDown={handleInputKeyDown} />
			{browsing ? (
				<div data-slot="filter-field-picker-breadcrumb" className="flex min-w-0 items-center gap-1 px-1 pt-1">
					<Button type="button" variant="ghost" size="xs" onClick={handleBack}>
						<ChevronLeftIcon aria-hidden="true" className="rtl:rotate-180" />
						{labels.back}
					</Button>
					<span className="min-w-0 truncate text-xs text-muted-foreground">{formatFilterPath(actions.index, path, labels.pathSeparator)}</span>
				</div>
			) : null}
			<CommandList style={listStyle} className="p-1" aria-label={labels.fieldsLabel}>
				<CommandEmpty>{labels.empty}</CommandEmpty>
				{rows.map((row: PickerRow): React.JSX.Element => (
					<FieldPickerRow key={joinFilterPath(row.path)} row={row} labels={labels} onBranch={handleBranch} onLeaf={handleLeaf} />
				))}
			</CommandList>
			{footerActions === undefined || footerActions.length === 0 ? null : (
				<div role="group" aria-label={labels.actionsLabel} className="flex flex-wrap justify-end gap-1 border-t border-border p-1">
					{footerActions.map((action: FilterFieldPickerAction): React.JSX.Element => (
						<Button key={action.value} type="button" variant="ghost" size="xs" disabled={action.disabled === true} onClick={action.onSelect}>
							{action.label}
						</Button>
					))}
				</div>
			)}
			<div role="status" aria-live="polite" className="sr-only">
				{normalizedQuery === "" ? "" : labels.resultsAnnouncement(rows.length)}
			</div>
		</Command>
	);
});

/** The draft-driven field step of the Add filter popover. */
function FieldStep(): React.JSX.Element {
	const actions = useFilterActions();
	const { draft } = useFilterState();
	const { dispatchDraft } = actions;
	const handlePathChange = React.useCallback(
		(next: readonly string[]): void => {
			dispatchDraft({ type: "setCascaderPath", path: next });
		},
		[dispatchDraft],
	);
	const handleQueryChange = React.useCallback(
		(query: string): void => {
			dispatchDraft({ type: "setQuery", query });
		},
		[dispatchDraft],
	);
	const handleSelect = React.useCallback(
		(path: readonly string[], defaultOperator: string | null): void => {
			dispatchDraft({ type: "selectField", path, defaultOperator });
		},
		[dispatchDraft],
	);
	return (
		<FilterFieldPicker
			path={draft?.cascaderPath ?? EMPTY_PATH}
			onPathChange={handlePathChange}
			query={draft?.query ?? ""}
			onQueryChange={handleQueryChange}
			onSelect={handleSelect}
		/>
	);
}

const EMPTY_PATH: readonly string[] = [];

export interface FiltersBuilderProps {
	/** Replaces the default Add filter button. Rendered as the popover's trigger. */
	readonly trigger?: React.ReactElement | undefined;
	readonly className?: string | undefined;
}

/**
 * The Add filter popover. ONE panel, the field step: picking a field commits
 * the rule and opens the operator menu on the new chip. `open` derives from the
 * draft and `openCreate` is gated, so read-only and disabled shut every route.
 */
export const FiltersBuilder = React.forwardRef<HTMLDivElement, FiltersBuilderProps>(function FiltersBuilder({ trigger, className }, ref): React.JSX.Element {
	const actions = useFilterActions();
	const sizes = filterControlSizes(actions);
	const { draft, ruleCount } = useFilterState();
	const open = draft?.ruleId === null;
	const compact = ruleCount > 0;
	const { openCreate, closeDraft } = actions;

	const handleOpenChange = React.useCallback(
		(next: boolean): void => {
			if (next) {
				openCreate();
				return;
			}
			closeDraft();
		},
		[openCreate, closeDraft],
	);

	const defaultTrigger = React.useMemo(
		(): React.ReactElement => (
			<Button
				variant="outline"
				size={compact ? sizes.icon : sizes.button}
				aria-label={compact ? actions.labels.addFilter : undefined}
				className="transition-[color,background-color,border-color,box-shadow]">
				<ListFilterPlusIcon aria-hidden="true" />
				{compact ? null : actions.labels.addFilter}
			</Button>
		),
		[compact, sizes, actions.labels.addFilter],
	);

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger disabled={actions.disabled} {...filterReadOnlyProps(actions)} render={trigger ?? defaultTrigger} />
			<PopoverContent ref={ref} align="start" className={cn(FILTER_FIELD_PICKER_CLASS, actions.fieldPickerClassName, className)}>
				<FieldStep />
			</PopoverContent>
		</Popover>
	);
});
