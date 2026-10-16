"use client";

import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList, CommandSeparator } from "@workspace/ui/components/command";
import { Input } from "@workspace/ui/components/input";
import { cn } from "@workspace/ui/lib/core/utils";
import { isArrayValue, isBooleanPrimitive, isNumberPrimitive, isStringPrimitive } from "@workspace/shared";
import { cva, type VariantProps } from "class-variance-authority";
import { CheckIcon, XIcon } from "lucide-react";
import * as React from "react";

import { filterControlSizes, useOptionalFilterActions, type FilterResolutionStore } from "./filters-context";
import { applyFilterExclusiveSelection, filterFilterOptions, joinFilterPath, normalizeFilterQuery, warnFilterOnce } from "./filters-lib";
import { getFilterArity } from "./filters-operators";
import {
	FILTER_AUTOFOCUS_ATTRIBUTE,
	filterValueItems,
	type FilterAutoFocusProps,
	type FilterEditor,
	type FilterEditorProps,
	type FilterEditorRegistry,
	type FilterField,
	type FilterIndex,
	type FilterLabels,
	type FilterLoadResult,
	type FilterOperator,
	type FilterOption,
	type FilterOptionsState,
	type FilterSortMode,
	type FilterValue,
	type FilterValueItem,
} from "./filters-types";

/* -------------------------------------------------------------------------- */
/*                              The options service                           */
/* -------------------------------------------------------------------------- */

interface OptionsInternalState {
	readonly items: readonly FilterOption[];
	readonly loading: boolean;
	readonly error: boolean;
	readonly hasMore: boolean;
	readonly cursor: string | undefined;
}

const IDLE_OPTIONS: OptionsInternalState = { items: [], loading: false, error: false, hasMore: false, cursor: undefined };

/** How long a typed query waits before it reaches `loadOptions`. */
export const FILTER_OPTIONS_DEBOUNCE_MS = 250;

/** Joins stored values into one comparable key; NUL cannot occur in a stored value. */
const VALUE_KEY_SEPARATOR = "\u0000";

function emptySubscribe(): () => void {
	return noop;
}

function noop(): void {
	return;
}

function zeroVersion(): number {
	return 0;
}

function isOptionList(result: readonly FilterOption[] | FilterLoadResult): result is readonly FilterOption[] {
	return isArrayValue(result);
}

/**
 * The joined path of a field, from the schema index. Keyed by PATH, not field
 * identity, so labels survive a schema rebuild; an unknown field uses its id.
 */
function filterFieldKey(field: FilterField | undefined, index: FilterIndex | undefined): string | null {
	if (field === undefined) {
		return null;
	}
	const entry = index?.all.find((candidate: { readonly field: FilterField }): boolean => candidate.field === field);
	return entry === undefined ? `#${field.id}` : joinFilterPath(entry.path);
}

/**
 * The shared option service every option-backed editor receives: debouncing,
 * aborting, cursor paging and value-to-label resolution. Resolution is
 * two-tier: this hook's own cache plus the root's `FilterResolutionStore`.
 */
export function useFilterOptions(field: FilterField | undefined, enabled: boolean, debounceMs: number = FILTER_OPTIONS_DEBOUNCE_MS): FilterOptionsState {
	const [query, setQueryState] = React.useState("");
	const [state, setState] = React.useState<OptionsInternalState>(IDLE_OPTIONS);
	const requestId = React.useRef(0);
	const abortRef = React.useRef<AbortController | null>(null);

	// Read directly, so this degrades outside a `Filters` root instead of throwing.
	const actionsContext = useOptionalFilterActions();
	const shared: FilterResolutionStore | null = actionsContext?.resolution ?? null;
	const sharedKey = filterFieldKey(field, actionsContext?.index);

	// Re-render when a label lands ANYWHERE under this root, not just here.
	React.useSyncExternalStore(shared?.subscribe ?? emptySubscribe, shared?.getVersion ?? zeroVersion, shared?.getVersion ?? zeroVersion);

	const staticOptions = field?.options;
	const loadOptions = field?.loadOptions;
	const isAsync = loadOptions !== undefined;

	React.useEffect((): void => {
		if (shared === null || sharedKey === null) {
			return;
		}
		if (staticOptions !== undefined) {
			shared.set(sharedKey, staticOptions);
		}
		if (state.items.length > 0) {
			shared.set(sharedKey, state.items);
		}
	}, [staticOptions, state.items, shared, sharedKey]);

	const run = React.useCallback(
		async (nextQuery: string, cursor: string | undefined, append: boolean): Promise<void> => {
			if (loadOptions === undefined) {
				return;
			}
			abortRef.current?.abort();
			const controller = new AbortController();
			abortRef.current = controller;
			requestId.current += 1;
			const id = requestId.current;
			setState((previous: OptionsInternalState): OptionsInternalState => ({ ...previous, loading: true, error: false, items: append ? previous.items : [] }));
			try {
				const result = await loadOptions(nextQuery, { signal: controller.signal, cursor });
				// A superseded request must not write; the id, not the abort, decides.
				if (id !== requestId.current) {
					return;
				}
				const normalized: FilterLoadResult = isOptionList(result) ? { items: result } : result;
				setState((previous: OptionsInternalState): OptionsInternalState => ({
					items: append ? [...previous.items, ...normalized.items] : normalized.items,
					loading: false,
					error: false,
					hasMore: normalized.hasMore ?? normalized.nextCursor !== undefined,
					cursor: normalized.nextCursor,
				}));
			} catch (error: unknown) {
				if (id !== requestId.current || (error instanceof Error && error.name === "AbortError")) {
					return;
				}
				setState((previous: OptionsInternalState): OptionsInternalState => ({ ...previous, loading: false, error: true, hasMore: false }));
			}
		},
		[loadOptions],
	);

	React.useEffect((): (() => void) | undefined => {
		if (!enabled || !isAsync) {
			return undefined;
		}
		const timer = setTimeout((): void => {
			void run(query, undefined, false);
		}, debounceMs);
		return (): void => {
			clearTimeout(timer);
		};
	}, [enabled, isAsync, query, debounceMs, run]);

	React.useEffect(
		(): (() => void) => (): void => {
			abortRef.current?.abort();
		},
		[],
	);

	const normalizedQuery = normalizeFilterQuery(query);

	// Async results are server-filtered; re-filtering hides what the label omits.
	const items = React.useMemo(
		(): readonly FilterOption[] => (isAsync ? state.items : filterFilterOptions(staticOptions ?? [], normalizedQuery)),
		[isAsync, state.items, staticOptions, normalizedQuery],
	);

	const setQuery = React.useCallback((next: string): void => {
		setQueryState(next);
	}, []);

	const loadMore = React.useCallback((): void => {
		if (!state.hasMore || state.loading) {
			return;
		}
		void run(query, state.cursor, true);
	}, [state.hasMore, state.loading, state.cursor, query, run]);

	const retry = React.useCallback((): void => {
		void run(query, undefined, false);
	}, [query, run]);

	const loadedItems = state.items;
	const resolve = React.useCallback(
		(value: string): FilterOption | undefined => {
			const declared = staticOptions?.find((option: FilterOption): boolean => option.value === value);
			if (declared !== undefined) {
				return declared;
			}
			const fromShared = shared !== null && sharedKey !== null ? shared.get(sharedKey, value) : undefined;
			return fromShared ?? loadedItems.find((option: FilterOption): boolean => option.value === value);
		},
		[staticOptions, shared, sharedKey, loadedItems],
	);

	return React.useMemo(
		(): FilterOptionsState => ({ items, loading: state.loading, error: state.error, hasMore: state.hasMore, query, setQuery, loadMore, retry, resolve }),
		[items, state.loading, state.error, state.hasMore, query, setQuery, loadMore, retry, resolve],
	);
}

/** A stored item as an option value, or null when it is not one (numbers stringify). */
function optionValueOf(item: FilterValueItem): string | null {
	if (isStringPrimitive(item)) {
		return item;
	}
	if (isNumberPrimitive(item) || isBooleanPrimitive(item)) {
		return String(item);
	}
	return null;
}

/** The stored value as option values, for an option-backed field. */
export function filterOptionValues(value: FilterValue | undefined): readonly string[] {
	return filterValueItems(value)
		.map(optionValueOf)
		.filter((entry: string | null): entry is string => entry !== null);
}

/**
 * Resolves committed values no loaded page covered, through `resolveValues`: a
 * restored saved view holds ids the loader never returned. The claim set marks
 * an id asked, so only a REJECTED resolve lets a later mount retry.
 */
export function useFilterValueResolution(field: FilterField | undefined, values: readonly string[]): void {
	const actionsContext = useOptionalFilterActions();
	const shared = actionsContext?.resolution ?? null;
	const sharedKey = filterFieldKey(field, actionsContext?.index);
	const resolveValues = field?.resolveValues;
	const staticOptions = field?.options;
	const valuesKey = values.join(VALUE_KEY_SEPARATOR);

	React.useEffect((): void => {
		if (resolveValues === undefined || shared === null || sharedKey === null || valuesKey === "") {
			return;
		}
		const missing = valuesKey
			.split(VALUE_KEY_SEPARATOR)
			.filter(
				(value: string): boolean => staticOptions?.some((option: FilterOption): boolean => option.value === value) !== true && shared.get(sharedKey, value) === undefined,
			);
		const wanted = shared.claim(sharedKey, missing);
		if (wanted.length === 0) {
			return;
		}
		// No unmount guard: the store outlives the component.
		Promise.resolve(resolveValues(wanted)).then(
			(options: readonly FilterOption[]): void => {
				shared.set(sharedKey, options);
			},
			(): void => {
				shared.release(sharedKey, wanted);
			},
		);
	}, [resolveValues, shared, sharedKey, valuesKey, staticOptions]);
}

/**
 * The element a host should focus as an editor's panel opens: the one the
 * editor marked with `autoFocusProps`, or null to let the popover pick its
 * first focusable element.
 */
export function findFilterAutoFocusTarget(container: HTMLElement | null): HTMLElement | null {
	return container?.querySelector<HTMLElement>(`[${FILTER_AUTOFOCUS_ATTRIBUTE}]`) ?? null;
}

/* -------------------------------------------------------------------------- */
/*                               Shared chrome                                */
/* -------------------------------------------------------------------------- */

/**
 * The panel every editor renders into. A plain flex column, NOT a combobox: an
 * editor inside a composite would inherit its arrow keys.
 */
export const filterEditorPanelVariants = cva("flex min-w-0 flex-col", {
	variants: {
		variant: {
			text: "w-72 max-w-[calc(100vw-2rem)] gap-2 p-2",
			number: "w-56 gap-2 p-2",
			range: "w-72 max-w-[calc(100vw-2rem)] gap-2 p-2",
			options: "w-48 gap-0 p-0",
			boolean: "w-40 gap-0 p-0",
		},
		state: {
			default: "",
			disabled: "pointer-events-none opacity-50",
		},
	},
	defaultVariants: { variant: "text", state: "default" },
});

type FilterEditorPanelVariant = NonNullable<VariantProps<typeof filterEditorPanelVariants>["variant"]>;

interface EditorPanelProps {
	readonly variant: FilterEditorPanelVariant;
	readonly className?: string | undefined;
	readonly children: React.ReactNode;
}

const EditorPanel = React.forwardRef<HTMLDivElement, EditorPanelProps>(function EditorPanel({ variant, className, children }, ref): React.JSX.Element {
	return (
		<div ref={ref} data-slot="filter-editor" className={cn(filterEditorPanelVariants({ variant }), className)}>
			{children}
		</div>
	);
});

interface EditorFooterProps {
	readonly labels: FilterLabels;
	readonly host: FilterEditorProps["host"];
	readonly onCancel: () => void;
	readonly onCommit: () => void;
}

function EditorFooter({ labels, host, onCancel, onCommit }: EditorFooterProps): React.JSX.Element | null {
	const actions = useOptionalFilterActions();
	const sizes = filterControlSizes({ size: actions?.size ?? "default" });
	// The create host advances on commit and has Back; amend must offer discard.
	if (host === "create") {
		return null;
	}
	return (
		<div className="flex items-center justify-end gap-1.5 pt-1">
			<Button type="button" variant="ghost" size={sizes.button} onClick={onCancel}>
				{labels.discard}
			</Button>
			<Button type="button" size={sizes.button} onClick={onCommit}>
				{labels.apply}
			</Button>
		</div>
	);
}

interface EditorCommitButtonsProps {
	readonly labels: FilterLabels;
	readonly onCancel: () => void;
	readonly onCommit: () => void;
}

/**
 * Confirm and cancel, an OUTLINE pair FUSED onto the field's trailing edge.
 * Returns a FRAGMENT: `ButtonGroup` fuses DIRECT children only.
 */
function EditorCommitButtons({ labels, onCancel, onCommit }: EditorCommitButtonsProps): React.JSX.Element {
	return (
		<>
			<Button type="button" variant="outline" size="icon-sm" aria-label={labels.apply} onClick={onCommit}>
				<CheckIcon aria-hidden="true" />
			</Button>
			<Button type="button" variant="outline" size="icon-sm" aria-label={labels.discard} onClick={onCancel}>
				<XIcon aria-hidden="true" />
			</Button>
		</>
	);
}

/** Enter commits (outside an IME composition), Escape cancels without closing a surrounding dialog. */
function useCommitKeys(commit: () => void, cancel: () => void): (event: React.KeyboardEvent) => void {
	return React.useCallback(
		(event: React.KeyboardEvent): void => {
			if (event.key === "Enter" && !event.nativeEvent.isComposing) {
				event.preventDefault();
				commit();
				return;
			}
			if (event.key === "Escape") {
				event.preventDefault();
				event.stopPropagation();
				cancel();
			}
		},
		[commit, cancel],
	);
}

/** `commit` with no argument: the draft, as it stands. */
function useCommitDraft(commit: FilterEditorProps["commit"]): () => void {
	return React.useCallback((): void => {
		commit();
	}, [commit]);
}

/** A typed number, or undefined for an empty or unparseable box. */
function parseNumberInput(raw: string): number | undefined {
	if (raw.trim() === "") {
		return undefined;
	}
	const parsed = Number(raw);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function numberText(item: FilterValueItem | FilterValue | undefined): string {
	return isNumberPrimitive(item) ? String(item) : "";
}

/* -------------------------------------------------------------------------- */
/*                                Text / number                               */
/* -------------------------------------------------------------------------- */

export const FilterTextEditor = React.forwardRef<HTMLDivElement, FilterEditorProps>(function FilterTextEditor(
	{ value, onValueChange, commit, cancel, autoFocusProps, labels, host, field },
	ref,
): React.JSX.Element {
	const commitDraft = useCommitDraft(commit);
	const onKeyDown = useCommitKeys(commitDraft, cancel);
	const handleChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onValueChange(event.target.value === "" ? undefined : event.target.value);
		},
		[onValueChange],
	);
	return (
		<EditorPanel ref={ref} variant="text" className={field.className}>
			<ButtonGroup className="w-full">
				<Input
					{...autoFocusProps}
					value={isStringPrimitive(value) ? value : ""}
					placeholder={field.placeholder ?? labels.valuePlaceholder}
					aria-label={field.label}
					onChange={handleChange}
					onKeyDown={onKeyDown}
				/>
				{host === "create" ? null : <EditorCommitButtons labels={labels} onCancel={cancel} onCommit={commitDraft} />}
			</ButtonGroup>
		</EditorPanel>
	);
});

export const FilterNumberEditor = React.forwardRef<HTMLDivElement, FilterEditorProps>(function FilterNumberEditor(
	{ value, onValueChange, commit, cancel, autoFocusProps, labels, host, field },
	ref,
): React.JSX.Element {
	const commitDraft = useCommitDraft(commit);
	const onKeyDown = useCommitKeys(commitDraft, cancel);
	const handleChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onValueChange(parseNumberInput(event.target.value));
		},
		[onValueChange],
	);
	return (
		<EditorPanel ref={ref} variant="number" className={field.className}>
			<ButtonGroup className="w-full">
				<Input
					{...autoFocusProps}
					type="number"
					value={numberText(value)}
					placeholder={field.placeholder}
					aria-label={field.label}
					onChange={handleChange}
					onKeyDown={onKeyDown}
				/>
				{host === "create" ? null : <EditorCommitButtons labels={labels} onCancel={cancel} onCommit={commitDraft} />}
			</ButtonGroup>
		</EditorPanel>
	);
});

export const FilterRangeEditor = React.forwardRef<HTMLDivElement, FilterEditorProps>(function FilterRangeEditor(
	{ value, onValueChange, commit, cancel, autoFocusProps, labels, host, field },
	ref,
): React.JSX.Element {
	const [from = null, to = null] = filterValueItems(value);
	const commitDraft = useCommitDraft(commit);
	const onKeyDown = useCommitKeys(commitDraft, cancel);
	const handleFromChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onValueChange([parseNumberInput(event.target.value) ?? null, to]);
		},
		[onValueChange, to],
	);
	const handleToChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onValueChange([from, parseNumberInput(event.target.value) ?? null]);
		},
		[onValueChange, from],
	);
	return (
		<EditorPanel ref={ref} variant="range" className={field.className}>
			<div className="flex items-center gap-1.5">
				<Input {...autoFocusProps} type="number" value={numberText(from)} aria-label={labels.rangeFrom(field.label)} onChange={handleFromChange} onKeyDown={onKeyDown} />
				<span className="text-xs text-muted-foreground">{labels.rangeSeparator}</span>
				<Input type="number" value={numberText(to)} aria-label={labels.rangeTo(field.label)} onChange={handleToChange} onKeyDown={onKeyDown} />
			</div>
			<EditorFooter host={host} labels={labels} onCancel={cancel} onCommit={commitDraft} />
		</EditorPanel>
	);
});

/* -------------------------------------------------------------------------- */
/*                                  The menu                                  */
/* -------------------------------------------------------------------------- */

/** One row. The shape both the operator menu and the option editors hand over. */
export interface FilterListItem {
	readonly value: string;
	readonly label: string;
	readonly icon?: React.ReactNode;
	readonly description?: string | undefined;
	readonly keywords?: readonly string[] | undefined;
	readonly disabled?: boolean | undefined;
	/** A None row, from `FilterOption.exclusive`. LAYOUT only: the rule lives in the option editor. */
	readonly exclusive?: boolean | undefined;
}

/** The paging affordances an option list's footer offers. */
export type FilterMenuState = Pick<FilterOptionsState, "loading" | "error" | "hasMore" | "loadMore" | "retry">;

export interface FilterMenuProps {
	readonly items: readonly FilterListItem[];
	/** Committed values. Drives the check mark and the pinned group. */
	readonly selected: readonly string[];
	readonly multiple?: boolean | undefined;
	/** Receives the FULL next selection, so no caller re-derives it. */
	readonly onSelectionChange: (values: readonly string[]) => void;
	readonly labels: FilterLabels;
	readonly ariaLabel: string;
	readonly searchPlaceholder?: string | undefined;
	/** Whether the search field is VISIBLE. It is always rendered: it owns the keyboard. */
	readonly searchable?: boolean | undefined;
	/** Viewport height before the list scrolls, in pixels. */
	readonly maxHeight?: number | undefined;
	/** Pin selected rows above the rest, with a rule between them. */
	readonly pinSelected?: boolean | undefined;
	/** Order INSIDE each group, plus WHEN the partition is taken. */
	readonly sortSelected?: FilterSortMode | undefined;
	/** The caller already filtered `items`, so the menu must not re-filter. */
	readonly preFiltered?: boolean | undefined;
	readonly autoFocusProps?: FilterAutoFocusProps | undefined;
	/** Controlled query. Pair it with `onQueryChange` to filter outside. */
	readonly query?: string | undefined;
	readonly onQueryChange?: ((query: string) => void) | undefined;
	readonly state?: FilterMenuState | undefined;
	readonly className?: string | undefined;
}

/** Joins a selection into one comparable key; NUL cannot occur in a value. */
const PIN_SEPARATOR = "\u0000";

function byLabel(left: FilterListItem, right: FilterListItem): number {
	return left.label.localeCompare(right.label);
}

interface FilterMenuRows {
	readonly rows: readonly FilterListItem[];
	/** Index of the first row after the pinned picks, or -1 when nothing is pinned. */
	readonly pinDividerAt: number;
	/** Index of the first exclusive row, or -1 when the list has none. */
	readonly exclusiveAt: number;
}

/**
 * The menu's render order: pinned picks, the rest, then exclusive rows apart
 * (their position is fixed by ROLE, never by selection).
 */
export function partitionFilterMenuItems(items: readonly FilterListItem[], pinned: ReadonlySet<string>, sortSelected: FilterSortMode): FilterMenuRows {
	const exclusive = items.filter((item: FilterListItem): boolean => item.exclusive === true);
	const values = items.filter((item: FilterListItem): boolean => item.exclusive !== true);
	const chosen = values.filter((item: FilterListItem): boolean => pinned.has(item.value));
	const rest = pinned.size === 0 ? values : values.filter((item: FilterListItem): boolean => !pinned.has(item.value));
	const sort = (list: readonly FilterListItem[]): readonly FilterListItem[] => (sortSelected === "label" ? [...list].sort(byLabel) : list);
	const rows = [...sort(chosen), ...sort(rest), ...sort(exclusive)];
	return {
		rows,
		pinDividerAt: chosen.length > 0 && chosen.length < rows.length ? chosen.length : -1,
		exclusiveAt: exclusive.length > 0 && exclusive.length < rows.length ? rows.length - exclusive.length : -1,
	};
}

/** The next selection after a press on `value`. Pure. */
export function toggleFilterMenuSelection(selected: readonly string[], value: string, multiple: boolean): readonly string[] {
	const isSelected = selected.includes(value);
	if (multiple) {
		return isSelected ? selected.filter((entry: string): boolean => entry !== value) : [...selected, value];
	}
	return isSelected ? [] : [value];
}

interface FilterMenuRowProps {
	readonly item: FilterListItem;
	readonly selected: boolean;
	readonly divider: boolean;
	readonly exclusiveHint: string;
	readonly onToggle: (value: string) => void;
}

const FilterMenuRow = React.memo(function FilterMenuRow({ item, selected, divider, exclusiveHint, onToggle }: FilterMenuRowProps): React.JSX.Element {
	const handleSelect = React.useCallback((): void => {
		onToggle(item.value);
	}, [onToggle, item.value]);
	return (
		<>
			{divider ? <CommandSeparator data-slot="filter-menu-divider" className="my-1" /> : null}
			<CommandItem
				value={item.value}
				disabled={item.disabled === true}
				onSelect={handleSelect}
				data-checked={selected}
				aria-checked={selected}
				data-exclusive={item.exclusive === true ? "" : undefined}
				className="px-2 py-1.5">
				{item.icon === undefined || item.icon === null ? null : (
					<span data-slot="filter-menu-icon" className="flex shrink-0 items-center justify-center text-muted-foreground">
						{item.icon}
					</span>
				)}
				<span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
					<span className="w-full truncate text-start">{item.label}</span>
					{item.description === undefined ? null : <span className="w-full truncate text-start text-xs text-muted-foreground">{item.description}</span>}
				</span>
				{item.exclusive === true && exclusiveHint !== "" ? (
					<span data-slot="filter-menu-exclusive-hint" className="sr-only">
						{`, ${exclusiveHint}`}
					</span>
				) : null}
			</CommandItem>
		</>
	);
});

/**
 * One accessible list, shared by the operator menu and every option editor: a
 * `Command` (cmdk listbox) run flat with its own search. cmdk tracks the
 * highlight by VALUE, so a live re-pin never moves it under the pointer.
 */
export const FilterMenu = React.forwardRef<HTMLDivElement, FilterMenuProps>(function FilterMenu(
	{
		items,
		selected,
		multiple = false,
		onSelectionChange,
		labels,
		ariaLabel,
		searchPlaceholder,
		searchable = true,
		maxHeight,
		pinSelected = false,
		sortSelected = "none",
		preFiltered = false,
		autoFocusProps,
		query,
		onQueryChange,
		state,
		className,
	},
	ref,
): React.JSX.Element {
	// The pin set as a KEY: `selected` is a fresh array on most renders.
	const liveKey = pinSelected ? selected.join(PIN_SEPARATOR) : "";
	// Frozen at OPEN for `sortSelected: "snapshot"`.
	const [snapshotKey] = React.useState(liveKey);
	const pinnedKey = pinSelected ? (sortSelected === "snapshot" ? snapshotKey : liveKey) : "";

	// Uncontrolled unless the caller owns the query, as an option service does.
	const [ownQuery, setOwnQuery] = React.useState("");
	const currentQuery = query ?? ownQuery;
	const setQuery = onQueryChange ?? setOwnQuery;

	const visibleItems = React.useMemo((): readonly FilterListItem[] => {
		const normalized = normalizeFilterQuery(currentQuery);
		if (preFiltered || normalized === "") {
			return items;
		}
		return items.filter(
			(item: FilterListItem): boolean =>
				item.label.toLocaleLowerCase().includes(normalized) || (item.keywords ?? []).some((keyword: string): boolean => keyword.toLocaleLowerCase().includes(normalized)),
		);
	}, [items, preFiltered, currentQuery]);

	const partition = React.useMemo(
		(): FilterMenuRows => partitionFilterMenuItems(visibleItems, new Set(pinnedKey === "" ? [] : pinnedKey.split(PIN_SEPARATOR)), sortSelected),
		[visibleItems, pinnedKey, sortSelected],
	);
	// No pin rule under a query: "your picks, then the rest" is about the WHOLE list.
	const pinDividerAt = currentQuery.trim() === "" ? partition.pinDividerAt : -1;

	const selectedSet = React.useMemo((): ReadonlySet<string> => new Set(selected), [selected]);

	const handleToggle = React.useCallback(
		(value: string): void => {
			onSelectionChange(toggleFilterMenuSelection(selected, value, multiple));
		},
		[onSelectionChange, selected, multiple],
	);

	const listStyle = React.useMemo((): React.CSSProperties | undefined => (maxHeight === undefined ? undefined : { maxHeight }), [maxHeight]);
	const showResults = currentQuery.trim() !== "";

	return (
		<Command ref={ref} data-slot="filter-menu" shouldFilter={false} loop label={ariaLabel} className={cn("rounded-none! bg-transparent p-0", className)}>
			<div data-slot="filter-menu-search" className={searchable ? undefined : "sr-only"}>
				<CommandInput {...autoFocusProps} value={currentQuery} onValueChange={setQuery} placeholder={searchPlaceholder ?? labels.searchOptions} aria-label={ariaLabel} />
			</div>
			<CommandList style={listStyle} className="p-1">
				<CommandEmpty>{state?.error === true ? labels.error : state?.loading === true ? labels.loading : labels.empty}</CommandEmpty>
				{partition.rows.map((item: FilterListItem, index: number): React.JSX.Element => (
					<FilterMenuRow
						key={item.value}
						item={item}
						selected={selectedSet.has(item.value)}
						divider={index === pinDividerAt || index === partition.exclusiveAt}
						exclusiveHint={labels.exclusiveHint}
						onToggle={handleToggle}
					/>
				))}
			</CommandList>
			<FilterMenuFooter labels={labels} state={state} />
			<div role="status" aria-live="polite" className="sr-only">
				{showResults ? labels.resultsAnnouncement(partition.rows.length) : ""}
			</div>
		</Command>
	);
});

interface FilterMenuFooterProps {
	readonly labels: FilterLabels;
	readonly state: FilterMenuState | undefined;
}

/** Paging and retry in a footer, never a row: a row would join the option ring. */
function FilterMenuFooter({ labels, state }: FilterMenuFooterProps): React.JSX.Element | null {
	if (state === undefined || (!state.error && !state.hasMore)) {
		return null;
	}
	return (
		<div role="group" aria-label={labels.actionsLabel} data-slot="filter-menu-footer" className="flex justify-center border-t border-border p-1">
			{state.error ? (
				<Button type="button" variant="ghost" size="xs" onClick={state.retry}>
					{labels.retry}
				</Button>
			) : (
				<Button type="button" variant="ghost" size="xs" disabled={state.loading} onClick={state.loadMore}>
					{state.loading ? labels.loadingMore : labels.loadMore}
				</Button>
			)}
		</div>
	);
}

/* -------------------------------------------------------------------------- */
/*                              Option based editors                          */
/* -------------------------------------------------------------------------- */

function toListItem(option: FilterOption): FilterListItem {
	return {
		value: option.value,
		label: option.label,
		icon: option.icon,
		description: option.description,
		keywords: option.keywords,
		disabled: option.disabled,
		exclusive: option.exclusive,
	};
}

interface OptionEditorProps extends FilterEditorProps {
	readonly multiple: boolean;
}

const OptionEditor = React.forwardRef<HTMLDivElement, OptionEditorProps>(function OptionEditor(
	{ multiple, options, labels, autoFocusProps, commit, cancel, onValueChange, value, field },
	ref,
): React.JSX.Element {
	const selected = React.useMemo((): readonly string[] => filterOptionValues(value), [value]);
	const announce = useOptionalFilterActions()?.announce;
	const items = React.useMemo((): readonly FilterListItem[] => options.items.map(toListItem), [options.items]);

	const handleSelectionChange = React.useCallback(
		(raw: readonly string[]): void => {
			// The ONE place the None rule is applied: every route into a selection arrives here.
			const values = applyFilterExclusiveSelection(raw, selected, (entry: string): boolean => options.resolve(entry)?.exclusive === true);
			if (values !== raw) {
				const arrived = values.find((entry: string): boolean => !selected.includes(entry));
				const cleared = raw.length - values.length;
				if (arrived !== undefined && cleared > 0 && announce !== undefined) {
					announce(labels.exclusiveAnnouncement(options.resolve(arrived)?.label ?? arrived, cleared));
				}
			} else if (raw.length > 1) {
				const hasNoneRow =
					options.items.some((item: FilterOption): boolean => item.exclusive === true) ||
					field.options?.some((option: FilterOption): boolean => option.exclusive === true) === true;
				const unresolved = hasNoneRow ? raw.find((entry: string): boolean => options.resolve(entry) === undefined) : undefined;
				if (unresolved !== undefined) {
					warnFilterOnce(
						`exclusive-unresolved:${field.id}`,
						`field "${field.id}" has an exclusive option, but the value "${unresolved}" resolves to no option, so the None rule cannot tell whether it is the exclusive one. Declare the exclusive option in the field's \`options\`, or cover stored values with \`resolveValues\`.`,
					);
				}
			}
			if (!multiple) {
				const [next] = values;
				// Deselecting the committed row leaves nothing to filter on.
				if (next === undefined) {
					cancel();
					return;
				}
				onValueChange(next);
				commit(next);
				return;
			}
			onValueChange(values);
			// Every toggle commits with the popover open: several picks, one gesture.
			commit(values, { close: false });
		},
		[selected, options, announce, labels, field, multiple, cancel, onValueChange, commit],
	);

	return (
		<EditorPanel ref={ref} variant="options" className={field.className}>
			<FilterMenu
				items={items}
				selected={selected}
				multiple={multiple}
				onSelectionChange={handleSelectionChange}
				labels={labels}
				ariaLabel={field.label}
				searchable={field.searchable ?? true}
				searchPlaceholder={field.placeholder}
				pinSelected={field.pinSelected ?? false}
				sortSelected={field.sortSelected}
				preFiltered
				query={options.query}
				onQueryChange={options.setQuery}
				state={options}
				autoFocusProps={autoFocusProps}
			/>
		</EditorPanel>
	);
});

export const FilterSelectEditor = React.forwardRef<HTMLDivElement, FilterEditorProps>(function FilterSelectEditor(props, ref): React.JSX.Element {
	return <OptionEditor ref={ref} {...props} multiple={false} />;
});

export const FilterMultiSelectEditor = React.forwardRef<HTMLDivElement, FilterEditorProps>(function FilterMultiSelectEditor(props, ref): React.JSX.Element {
	return <OptionEditor ref={ref} {...props} multiple />;
});

/* -------------------------------------------------------------------------- */
/*                                   Boolean                                  */
/* -------------------------------------------------------------------------- */

/** The two stored option values a boolean menu uses. */
const BOOLEAN_TRUE_VALUE = "true";
const BOOLEAN_FALSE_VALUE = "false";

function booleanSelection(value: FilterValue | undefined): readonly string[] {
	if (value === true) {
		return [BOOLEAN_TRUE_VALUE];
	}
	return value === false ? [BOOLEAN_FALSE_VALUE] : [];
}

export const FilterBooleanEditor = React.forwardRef<HTMLDivElement, FilterEditorProps>(function FilterBooleanEditor(
	{ value, onValueChange, commit, labels, autoFocusProps, field },
	ref,
): React.JSX.Element {
	const items = React.useMemo(
		(): readonly FilterListItem[] => [
			{ value: BOOLEAN_TRUE_VALUE, label: labels.booleanTrue },
			{ value: BOOLEAN_FALSE_VALUE, label: labels.booleanFalse },
		],
		[labels.booleanTrue, labels.booleanFalse],
	);
	const selected = React.useMemo((): readonly string[] => booleanSelection(value), [value]);
	const handleSelectionChange = React.useCallback(
		(values: readonly string[]): void => {
			const [first] = values;
			// Deselecting the committed row leaves nothing to filter on: a no-op.
			if (first === undefined) {
				return;
			}
			const next = first === BOOLEAN_TRUE_VALUE;
			onValueChange(next);
			commit(next);
		},
		[onValueChange, commit],
	);
	return (
		<EditorPanel ref={ref} variant="boolean" className={field.className}>
			<FilterMenu
				items={items}
				selected={selected}
				onSelectionChange={handleSelectionChange}
				labels={labels}
				ariaLabel={field.label}
				searchable={false}
				autoFocusProps={autoFocusProps}
			/>
		</EditorPanel>
	);
});

/* -------------------------------------------------------------------------- */
/*                                  Resolution                                */
/* -------------------------------------------------------------------------- */

export const DEFAULT_FILTER_EDITORS: FilterEditorRegistry = {
	text: FilterTextEditor,
	number: FilterNumberEditor,
	range: FilterRangeEditor,
	select: FilterSelectEditor,
	multiselect: FilterMultiSelectEditor,
	boolean: FilterBooleanEditor,
};

/**
 * Picks the editor for a (field, operator) pair: the field's own `editor`, then
 * the operator's ARITY, then the field's `type`. Arity outranks type because
 * "between" wants two boxes whatever the field said.
 */
export function resolveFilterEditor(field: FilterField, operator: FilterOperator | undefined, editors: FilterEditorRegistry): FilterEditor | undefined {
	const { editor } = field;
	if (editor !== undefined) {
		if (!isStringPrimitive(editor)) {
			return editor;
		}
		const named = editors[editor];
		if (named !== undefined) {
			return named;
		}
	}
	const arity = getFilterArity(operator);
	if (arity === "none") {
		return undefined;
	}
	if (arity === "range") {
		return editors.range;
	}
	// An option-backed field gets a multi-select; anything else receives a list.
	if (arity === "many" && (field.options !== undefined || field.loadOptions !== undefined)) {
		return editors.multiselect;
	}
	return editors[field.type ?? "text"] ?? editors.text;
}

export type { FilterEditorRegistry } from "./filters-types";
