"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { isArrayValue, isFunctionValue } from "@workspace/shared";
import { useCascaderLoader, useCascaderLoadState } from "@workspace/ui/components/cascader/cascader-async";
import type { CascaderGetChildren, CascaderLoadErrorHandler, CascaderOnSearch, CascaderResolveValue } from "@workspace/ui/components/cascader/cascader-async";
import {
	CASCADER_NO_HIGHLIGHT,
	CascaderActionsContext,
	CascaderHighlightContext,
	CascaderRenderContext,
	CascaderStateContext,
	createCascaderHighlightStore,
	useCascaderActions,
	useCascaderHighlight,
	useCascaderRender,
	useCascaderState,
} from "@workspace/ui/components/cascader/cascader-context";
import type {
	CascaderActionsContextValue,
	CascaderColumn,
	CascaderExpandTrigger,
	CascaderHighlight,
	CascaderHighlightStore,
	CascaderItemState,
	CascaderRenderContextValue,
	CascaderRenderNode,
	CascaderStateContextValue,
} from "@workspace/ui/components/cascader/cascader-context";
import { useCascaderLabels } from "@workspace/ui/components/cascader/cascader-i18n";
import { toCascaderCssLength } from "@workspace/ui/components/cascader/cascader-columns";
import {
	applyCascadeSelection,
	buildCascaderIndex,
	CASCADER_LIST_HEIGHT_CLASS,
	CASCADER_LIST_PAD_CLASS,
	CASCADER_ROOT_KEY,
	CASCADER_ROWS_CLASS,
	CASCADER_SCROLL_CLASS,
	collapseCascaderPath,
	createCascaderMoreNode,
	filterCascaderLevel,
	findAmbiguousCascaderLabels,
	flattenCascaderTree,
	focusCascaderHome,
	getCascaderCheckedValues,
	getCascaderChildren,
	getCascaderCount,
	getCascaderIndeterminateFrom,
	getCascaderListedValues,
	getCascaderPath,
	getCascaderSelectedDescendants,
	getCascaderTabTarget,
	isCascaderBranch,
	isCascaderDisabled,
	isCascaderMoreNode,
	isCascaderSelectable,
	matchesCascaderQuery,
	mergeCascaderIndex,
	normalizeCascaderQuery,
	searchCascaderDeep,
	withCascaderMoreRow,
} from "@workspace/ui/components/cascader/cascader-lib";
import type { CascaderCheckedStrategy } from "@workspace/ui/components/cascader/cascader-lib";
import { CASCADER_OVERSCAN, CASCADER_ESTIMATE_ROW_SIZE_PX } from "@workspace/ui/components/cascader/cascader-virtual";
import type {
	CascaderActionItem,
	CascaderChangeDetails,
	CascaderChangeReason,
	CascaderFlatNode,
	CascaderIndex,
	CascaderLabels,
	CascaderLoadState,
	CascaderMode,
	CascaderNode,
	CascaderNodeBase,
	CascaderPathSegment,
	CascaderSearchScope,
	CascaderSelectable,
	CascaderSize,
} from "@workspace/ui/components/cascader/cascader-types";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { fieldStateVariants } from "@workspace/ui/lib/form/field-variants";
import { resolveFieldState } from "@workspace/ui/lib/form/field-state";
import { assignRef } from "@workspace/ui/lib/core/merge-refs";
import { cn } from "@workspace/ui/lib/core/utils";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { cva } from "class-variance-authority";
import { ChevronDownIcon, XIcon } from "lucide-react";
import * as React from "react";

/** Stable empty lists, so a cascader with no footer or no default path republishes nothing. */
const NO_ACTIONS: readonly CascaderActionItem[] = [];
const NO_VALUES: readonly string[] = [];
const NO_NODES: CascaderNodeBase[] = [];

/** Word joiner. A polite region reads only MUTATIONS, so it alternates on the end of the text. */
const ANNOUNCE_MARKER = "⁠";

/** Delay before a query's result count reaches the live region: re-announcing per keystroke plays back stale counts. */
export const CASCADER_ANNOUNCE_DEBOUNCE_MS = 150;

/** Row count at which windowing turns itself on. */
export const CASCADER_VIRTUALIZE_THRESHOLD = 100;

/** Joins level keys into one string, so a loading flip that leaves `hasMore` alone keeps the merged index. */
const PAGING_KEY_SEPARATOR = "\u001f";

/** The `onSearch` scope of a global search: no path, so the whole tree. */
const GLOBAL_SEARCH_PATH: readonly string[] = [];

/* -------------------------------------------------------------------------- */
/*                                   State                                    */
/* -------------------------------------------------------------------------- */

interface ControllableLatest<V, TMeta> {
	readonly value: V;
	readonly isControlled: boolean;
	readonly onChange: ((value: V, meta: TMeta) => void) | undefined;
}

/**
 * Controlled when the prop is defined, uncontrolled (from `defaultValue`)
 * otherwise — decided per prop, never a hybrid. The setter carries a `meta`
 * the change callback receives (a path change's reason, an open change's).
 */
function useControllable<V, TMeta>(
	controlled: V | undefined,
	defaultValue: V,
	onChange: ((value: V, meta: TMeta) => void) | undefined,
): readonly [V, (next: V, meta: TMeta) => void] {
	const [uncontrolled, setUncontrolled] = React.useState(defaultValue);
	const isControlled = controlled !== undefined;
	const value = isControlled ? controlled : uncontrolled;

	// Written in an EFFECT: a discarded render must not have advanced it.
	const latest = React.useRef<ControllableLatest<V, TMeta>>({ value, isControlled, onChange });
	// The last PROP seen: it differs from the optimistic advance exactly when a controlled parent declines a change.
	const lastProp = React.useRef(controlled);
	React.useEffect((): void => {
		latest.current = { value, isControlled, onChange };
		lastProp.current = controlled;
	});

	const set = React.useCallback((next: V, meta: TMeta): void => {
		const current = latest.current;
		if (Object.is(next, current.value) && (!current.isControlled || Object.is(next, lastProp.current))) {
			return;
		}
		// Advance now so two updates in ONE batch compose.
		latest.current = { ...current, value: next };
		if (!current.isControlled) {
			setUncontrolled(next);
		}
		current.onChange?.(next, meta);
	}, []);

	return [value, set];
}

function toSingleSelection(value: string | undefined): readonly string[] | undefined {
	if (value === undefined) {
		return undefined;
	}
	return value === "" ? NO_VALUES : [value];
}

function withoutBlank(values: readonly string[] | undefined): readonly string[] | undefined {
	if (values === undefined) {
		return undefined;
	}
	return values.some((value: string): boolean => value === "") ? values.filter((value: string): boolean => value !== "") : values;
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value: string, position: number): boolean => value === right.at(position));
}

/** A payload-free node, re-typed for the caller's payload: every field but `children` and `data`, which it never had. */
function retypeCascaderNode<TData>(node: CascaderNodeBase): CascaderNode<TData> {
	return {
		value: node.value,
		label: node.label,
		icon: node.icon,
		description: node.description,
		hasChildren: node.hasChildren,
		count: node.count,
		disabled: node.disabled,
		keywords: node.keywords,
		hasMore: node.hasMore,
	};
}

function isNodeList(value: CascaderNodeBase | CascaderNodeBase[] | null): value is CascaderNodeBase[] {
	return isArrayValue(value);
}

function itemToStringValue(item: CascaderNodeBase): string {
	return item.value;
}

function itemToStringLabel(item: CascaderNodeBase): string {
	return item.label;
}

function isItemEqualToValue(item: CascaderNodeBase, value: CascaderNodeBase): boolean {
	return item.value === value.value;
}

/* -------------------------------------------------------------------------- */
/*                                  Context                                   */
/* -------------------------------------------------------------------------- */

/** The pre-split shape, merged, so `useCascader()` returns what it always did. */
export interface CascaderContextValue extends CascaderActionsContextValue, CascaderStateContextValue {}

/**
 * The cascader's internals.
 * @deprecated Reads BOTH halves, so a caller re-renders on every keystroke. Prefer `useCascaderActions()` or `useCascaderState()`.
 */
export function useCascader(): CascaderContextValue {
	const actions = useCascaderActions();
	const state = useCascaderState();
	return React.useMemo((): CascaderContextValue => ({ ...actions, ...state }), [actions, state]);
}

/* -------------------------------------------------------------------------- */
/*                              Headless selection                            */
/* -------------------------------------------------------------------------- */

export interface CascaderSelection<TNode extends CascaderNodeBase = CascaderNodeBase> {
	/** The selected nodes, resolved. Empty when nothing is selected. */
	readonly selected: readonly TNode[];
	/** Ancestor chain per selected node, root first, node last. */
	readonly paths: readonly (readonly TNode[])[];
	/** The single selection, or the first one in `multiple` mode. */
	readonly first: TNode | null;
	/** Ancestor chain of `first`. */
	readonly firstPath: readonly TNode[];
	readonly count: number;
	readonly isEmpty: boolean;
	readonly multiple: boolean;
	readonly remove: (value: string) => void;
	readonly clear: () => void;
}

/**
 * Headless access to the selection, for a trigger that is not `CascaderValue`.
 * Pass your own `items` (and `getParent`, for flat input) to get the nodes back
 * TYPED, `data` included: the context carries no generic, so the payload is
 * resolved against the caller's own tree. Without `items`, nodes carry no `data`.
 */
export function useCascaderSelection<TData = undefined>(
	items?: readonly CascaderNode<TData>[],
	getParent?: (node: CascaderNode<TData>) => string | null | undefined,
): CascaderSelection<CascaderNode<TData>> {
	const { multiple, setSelection } = useCascaderActions();
	const { index, selectedValues } = useCascaderState();
	const typedIndex = React.useMemo((): CascaderIndex<CascaderNode<TData>> | null => (items === undefined ? null : buildCascaderIndex(items, getParent)), [items, getParent]);

	return React.useMemo((): CascaderSelection<CascaderNode<TData>> => {
		const toTyped = (node: CascaderNodeBase): CascaderNode<TData> => typedIndex?.byValue.get(node.value) ?? retypeCascaderNode<TData>(node);
		const selected = selectedValues
			.map((value: string): CascaderNodeBase | undefined => index.byValue.get(value))
			.filter((node: CascaderNodeBase | undefined): node is CascaderNodeBase => node !== undefined)
			.map(toTyped);
		const paths = selectedValues.map((value: string): CascaderNode<TData>[] => getCascaderPath(index, value).map(toTyped));
		const [first] = selected;
		const [firstPath] = paths;
		return {
			selected,
			paths,
			first: first ?? null,
			firstPath: firstPath ?? [],
			count: selectedValues.length,
			isEmpty: selectedValues.length === 0,
			multiple,
			remove: (value: string): void => {
				setSelection(selectedValues.filter((entry: string): boolean => entry !== value));
			},
			// Explicit reason: emptying on purpose is not "deselect the last node".
			clear: (): void => {
				setSelection([], "clear");
			},
		};
	}, [typedIndex, index, selectedValues, multiple, setSelection]);
}

/* -------------------------------------------------------------------------- */
/*                                    Root                                    */
/* -------------------------------------------------------------------------- */

/**
 * Why the navigation path changed.
 * - `"drill"`: a branch was entered (row press, level arrow, search hit).
 * - `"back"`: one level up (back control, Backspace on an empty query).
 * - `"breadcrumb"`: a jump to an exact depth in the trail.
 * - `"reveal"`: the reopen navigated to the level holding the selection.
 * - `"external"`: `setPath` called from outside the primitive's own flows.
 */
export type CascaderPathChangeReason = "drill" | "back" | "breadcrumb" | "reveal" | "external";

export interface CascaderPathChangeDetails {
	readonly reason: CascaderPathChangeReason;
}

/** Base UI's reason for an open change, or `"none"`. A single-select commit's close says `"item-press"`. */
export interface CascaderOpenChangeDetails {
	readonly reason: string;
}

/** Everything independent of the selection mode; the rest is on the two arms. */
export interface CascaderBaseProps<TData = undefined> {
	/** Nested tree, or a flat list when `getParent` is supplied. Keep it (and `getParent`) stable: the index rebuilds on identity. */
	readonly items: readonly CascaderNode<TData>[];
	/** Opt in to flat adjacency input by returning each node's parent value. */
	readonly getParent?: ((node: CascaderNode<TData>) => string | null | undefined) | undefined;
	/** The CALLER's loader for one level, called on demand; `node` is `null` for the root. Mark unfetched branches `hasChildren`. */
	readonly getChildren?: CascaderGetChildren<TData> | undefined;
	/** The CALLER's server search, debounced by `searchDebounce`; replaces the local scan while the query is set. Ignored in `mode="tree"`. */
	readonly onSearch?: CascaderOnSearch<TData> | undefined;
	/** Milliseconds of quiet before `onSearch` fires. */
	readonly searchDebounce?: number | undefined;
	/** The CALLER's resolver from a value the loader has never seen to its ancestor chain, so the trigger can path a server-supplied selection. */
	readonly resolveValue?: CascaderResolveValue<TData> | undefined;
	/** Cache key. Changing it drops every page and aborts anything in flight. */
	readonly loadKey?: string | number | boolean | null | undefined;
	/** Prefetch a highlighted branch's children after a pause. Off by default. */
	readonly prefetch?: boolean | undefined;
	/** Called when a load fails; never for an aborted or superseded request. */
	readonly onLoadError?: CascaderLoadErrorHandler | undefined;
	/** Which nodes may be committed. Defaults to leaves only. */
	readonly selectable?: CascaderSelectable<TData> | undefined;
	/** Whether the built-in SINGLE-SELECT check is drawn. Defaults to true. A no-op under `multiple`. */
	readonly indicator?: boolean | undefined;
	/** Footer ACTIONS: commands pinned below the list, never rows in it. Keep the array stable. */
	readonly actions?: readonly CascaderActionItem[] | undefined;
	/** Parent/child cascading. Multi-select only, and it needs committable branches. A commit sweeps the KNOWN subtree. */
	readonly cascade?: boolean | undefined;
	readonly mode?: CascaderMode | undefined;
	/** How a branch opens from the pointer in columns mode's ACTIVE column. Neither value ever commits. */
	readonly expandTrigger?: CascaderExpandTrigger | undefined;
	readonly path?: readonly string[] | undefined;
	readonly defaultPath?: readonly string[] | undefined;
	readonly onPathChange?: ((path: readonly string[], details: CascaderPathChangeDetails) => void) | undefined;
	readonly expanded?: readonly string[] | undefined;
	readonly defaultExpanded?: readonly string[] | undefined;
	readonly onExpandedChange?: ((expanded: readonly string[]) => void) | undefined;
	readonly open?: boolean | undefined;
	readonly defaultOpen?: boolean | undefined;
	readonly onOpenChange?: ((open: boolean, details: CascaderOpenChangeDetails) => void) | undefined;
	/** Whether a SINGLE-SELECT leaf commit closes the popup. Defaults to true. Ignored under `multiple`, which never closes. */
	readonly closeOnSelect?: boolean | undefined;
	readonly inputValue?: string | undefined;
	readonly defaultInputValue?: string | undefined;
	readonly onInputValueChange?: ((value: string) => void) | undefined;
	/** `"level"` (default) filters the level on screen, `"deep"` also searches below it, `"global"` searches the whole tree. */
	readonly searchScope?: CascaderSearchScope | undefined;
	/** Custom matcher, replacing label + keywords substring matching. */
	readonly filter?: ((node: CascaderNode<TData>, normalizedQuery: string) => boolean) | undefined;
	/** On open, navigate to the level holding the selection. Default true. */
	readonly revealSelected?: boolean | undefined;
	readonly maxHeight?: number | string | undefined;
	/** Window the rendered rows. `undefined` decides per level from `virtualizeThreshold`. Needs `CascaderVirtualItems` / `CascaderVirtualColumn`. */
	readonly virtualize?: boolean | undefined;
	readonly virtualizeThreshold?: number | undefined;
	readonly estimateRowSize?: number | undefined;
	readonly overscan?: number | undefined;
	/** Per-usage overrides of the `cascader` copy from `UiKitLabelsProvider`. Keep it a module constant. */
	readonly labels?: UiKitLabelsOverride<"cascader"> | undefined;
	/** Replaces the entire row, affordances included. */
	readonly renderItem?: ((node: CascaderNode<TData>, state: CascaderItemState<CascaderNode<TData>>) => React.ReactNode) | undefined;
	/** Replaces only the label block; icon, count, chevron and check stay. */
	readonly renderLabel?: ((node: CascaderNode<TData>, state: CascaderItemState<CascaderNode<TData>>) => React.ReactNode) | undefined;
	readonly disabled?: boolean | undefined;
	/** The trigger's loading state, while the caller resolves something the cascader cannot see. */
	readonly loading?: boolean | undefined;
	/** Density of the trigger, chips, search field and rows. */
	readonly size?: CascaderSize | undefined;
	/** Native form field name. Submits the selected value(s). */
	readonly name?: string | undefined;
	readonly form?: string | undefined;
	readonly id?: string | undefined;
	readonly required?: boolean | undefined;
	readonly readOnly?: boolean | undefined;
	/** Marks the field invalid: `aria-invalid` and `data-invalid` on the trigger, the chips and the input. No validation of its own. */
	readonly invalid?: boolean | undefined;
	/** Ref to the hidden input Base UI submits with, for form-library focus. */
	readonly inputRef?: React.Ref<HTMLInputElement> | undefined;
	/** Renders without a floating popup, for an embedded `CascaderPanel`. */
	readonly inline?: boolean | undefined;
	readonly children?: React.ReactNode;
}

export interface CascaderSingleProps<TData = undefined> extends CascaderBaseProps<TData> {
	readonly multiple?: false | undefined;
	/** The selected value; `""` is no selection. */
	readonly value?: string | undefined;
	readonly defaultValue?: string | undefined;
	readonly onValueChange?: ((value: string, details: CascaderChangeDetails<TData>) => void) | undefined;
	/** Only meaningful with `multiple`. */
	readonly max?: undefined;
}

/** Multi-select props. Enables checkbox rows and chip display. */
export interface CascaderMultipleProps<TData = undefined> extends CascaderBaseProps<TData> {
	readonly multiple: true;
	readonly value?: readonly string[] | undefined;
	readonly defaultValue?: readonly string[] | undefined;
	readonly onValueChange?: ((value: readonly string[], details: CascaderChangeDetails<TData>) => void) | undefined;
	/** Cap on selections. Further picks are refused, the existing ones survive. */
	readonly max?: number | undefined;
}

/** `multiple` discriminates: `value`, `onValueChange` and `max` narrow with it. */
export type CascaderProps<TData = undefined> = CascaderSingleProps<TData> | CascaderMultipleProps<TData>;

/** A navigation waiting on a fetch: a drill appends, a columns press replaces the trail from `depth`, a search hit swaps in its `trail`, a tree press expands. */
type CascaderPendingNavigation =
	| { readonly value: string; readonly kind: "push" | "expand" }
	| { readonly value: string; readonly kind: "at"; readonly depth: number }
	| { readonly value: string; readonly kind: "trail"; readonly trail: readonly string[] };

interface CascaderAnnounceSignal {
	readonly seq: number;
	/** The tree branch a toggle named. */
	readonly toggled: string | null;
	/** A one-off verbatim message: a `max` refusal, a cascade fan-out. */
	readonly notice: string | null;
}

interface CascaderAnnouncement {
	readonly text: string;
	/** Only a stream of keystrokes (the result count) is coalesced; every event-shaped announcement is immediate. */
	readonly defer: boolean;
}

/** One "frame" of the level-swap reset, released from a layout effect through an external store. */
interface CascaderFrameStore {
	readonly subscribe: (listener: () => void) => () => void;
	readonly getSnapshot: () => number;
	readonly release: (seq: number) => void;
}

function createCascaderFrameStore(): CascaderFrameStore {
	let released = 0;
	const listeners = new Set<() => void>();
	return {
		subscribe: (listener: () => void): (() => void) => {
			listeners.add(listener);
			return (): void => {
				listeners.delete(listener);
			};
		},
		getSnapshot: (): number => released,
		release: (seq: number): void => {
			if (released === seq) {
				return;
			}
			released = seq;
			for (const listener of listeners) {
				listener();
			}
		},
	};
}

interface CascaderLatest<TData> {
	readonly index: CascaderIndex<CascaderNode<TData>>;
	readonly state: CascaderStateContextValue;
	readonly mode: CascaderMode;
	readonly multiple: boolean;
	readonly cascade: boolean;
	readonly max: number | undefined;
	readonly labels: CascaderLabels;
	readonly closeOnSelect: boolean;
	readonly selectedValues: readonly string[];
	readonly path: readonly string[];
	readonly expandedList: readonly string[];
	readonly deepResults: readonly CascaderNodeBase[] | null;
	readonly emitValue: (values: readonly string[], details: CascaderChangeDetails<TData>) => void;
	readonly resolveTyped: (value: string) => CascaderNode<TData>;
	readonly isSelectable: (node: CascaderNodeBase) => boolean;
	readonly needsChildren: (node: CascaderNodeBase) => boolean;
	readonly expanded: ReadonlySet<string>;
}

/**
 * The cascader root: owns the selection (controlled through `value` /
 * `onValueChange`, or uncontrolled from `defaultValue`), the navigation and the
 * async cache, and threads them into the parts. Renders no element of its own,
 * so there is no ref to forward — `inputRef` reaches the hidden form input.
 * Generic over the caller's node payload, inferred from `items`.
 */
function Cascader<TData = undefined>(props: CascaderProps<TData>): React.JSX.Element {
	const {
		items,
		getParent,
		getChildren,
		onSearch,
		searchDebounce,
		resolveValue,
		loadKey,
		prefetch,
		onLoadError,
		selectable = "leaf",
		indicator = true,
		actions = NO_ACTIONS,
		cascade = false,
		mode = "drill",
		expandTrigger = "click",
		path: pathProp,
		defaultPath = NO_VALUES,
		onPathChange,
		expanded: expandedProp,
		defaultExpanded = NO_VALUES,
		onExpandedChange,
		open: openProp,
		defaultOpen = false,
		onOpenChange,
		closeOnSelect = true,
		inputValue: inputValueProp,
		defaultInputValue = "",
		onInputValueChange,
		searchScope = "level",
		filter,
		revealSelected = true,
		maxHeight,
		virtualize,
		virtualizeThreshold = CASCADER_VIRTUALIZE_THRESHOLD,
		estimateRowSize = CASCADER_ESTIMATE_ROW_SIZE_PX,
		overscan = CASCADER_OVERSCAN,
		labels: labelsOverride,
		renderItem,
		renderLabel,
		disabled = false,
		loading = false,
		size = "default",
		name,
		form,
		id,
		required,
		readOnly,
		invalid = false,
		inputRef,
		inline = false,
		children,
	} = props;
	const multiple = props.multiple === true;
	const max = props.multiple === true ? props.max : undefined;

	const baseIndex = React.useMemo((): CascaderIndex<CascaderNode<TData>> => buildCascaderIndex(items, getParent), [items, getParent]);
	const baseId = React.useId();
	const labels = useCascaderLabels(labelsOverride);

	/* --------------------------------- value -------------------------------- */

	const controlledValue = React.useMemo(
		(): readonly string[] | undefined => (props.multiple === true ? withoutBlank(props.value) : toSingleSelection(props.value)),
		[props.multiple, props.value],
	);
	const defaultValue = props.multiple === true ? (withoutBlank(props.defaultValue) ?? NO_VALUES) : (toSingleSelection(props.defaultValue) ?? NO_VALUES);
	const [selectedValues, setSelectedValues] = useControllable<readonly string[], null>(controlledValue, defaultValue, undefined);

	const onMultipleValueChange = props.multiple === true ? props.onValueChange : undefined;
	const onSingleValueChange = props.multiple === true ? undefined : props.onValueChange;
	const emitValue = React.useCallback(
		(values: readonly string[], details: CascaderChangeDetails<TData>): void => {
			onMultipleValueChange?.(values, details);
			onSingleValueChange?.(values.at(0) ?? "", details);
		},
		[onMultipleValueChange, onSingleValueChange],
	);

	const emitPathChange = React.useCallback(
		(next: readonly string[], reason: CascaderPathChangeReason): void => {
			onPathChange?.(next, { reason });
		},
		[onPathChange],
	);
	const emitOpenChange = React.useCallback(
		(next: boolean, reason: string): void => {
			onOpenChange?.(next, { reason });
		},
		[onOpenChange],
	);
	const emitExpandedChange = React.useCallback(
		(next: readonly string[]): void => {
			onExpandedChange?.(next);
		},
		[onExpandedChange],
	);
	const emitQueryChange = React.useCallback(
		(next: string): void => {
			onInputValueChange?.(next);
		},
		[onInputValueChange],
	);

	const [path, setPathWithReason] = useControllable<readonly string[], CascaderPathChangeReason>(pathProp, defaultPath, emitPathChange);
	const [expandedList, setExpandedList] = useControllable<readonly string[], null>(expandedProp, defaultExpanded, emitExpandedChange);
	const [open, setOpenWithReason] = useControllable<boolean, string>(openProp, defaultOpen, emitOpenChange);
	const [query, setQueryValue] = useControllable<string, null>(inputValueProp, defaultInputValue, emitQueryChange);

	const setQuery = React.useCallback(
		(next: string): void => {
			setQueryValue(next, null);
		},
		[setQueryValue],
	);
	const setPath = React.useCallback(
		(next: readonly string[]): void => {
			setPathWithReason(next, "external");
		},
		[setPathWithReason],
	);

	const expanded = React.useMemo((): ReadonlySet<string> => new Set(expandedList), [expandedList]);

	/* --------------------------------- async -------------------------------- */

	// On-screen levels, so the ones worth fetching. Columns shows the whole trail at once.
	const levels = React.useMemo((): readonly string[] => {
		if (mode === "tree") {
			return [CASCADER_ROOT_KEY, ...expandedList];
		}
		if (mode === "columns") {
			return [CASCADER_ROOT_KEY, ...path];
		}
		return [path.at(-1) ?? CASCADER_ROOT_KEY];
	}, [mode, path, expandedList]);

	// The level-settled callback lands in the navigation machinery declared below, through a ref written after commit.
	const settleRef = React.useRef<(key: string) => void>((): void => undefined);
	const handleLevelSettled = React.useCallback((key: string): void => {
		settleRef.current(key);
	}, []);

	const loader = useCascaderLoader<TData>({
		base: baseIndex,
		getChildren,
		// Gated, not merely unrendered: a tree hit belongs to no visible branch.
		onSearch: mode === "tree" ? undefined : onSearch,
		resolveValue,
		searchDebounce,
		loadKey,
		prefetch,
		onLoadError,
		onLevelSettled: handleLevelSettled,
		// An inline cascader is never "open", but its panel is live.
		enabled: open || inline,
		query,
		levels,
		path: searchScope === "global" ? GLOBAL_SEARCH_PATH : path,
		values: selectedValues,
	});

	const loadStates = loader.states;
	const { active: hasLoader, ensureLevel, retryLevel, retrySearch, invalidateLevel, loadMore, prefetchNode } = loader;

	/** Whether pressing this branch has to FETCH first: in flight, failed, or never asked. */
	const needsChildren = React.useCallback(
		(node: CascaderNodeBase): boolean => {
			if (!hasLoader) {
				return false;
			}
			const state = loadStates.get(node.value);
			if (state !== undefined) {
				return state.loading || state.error;
			}
			return !baseIndex.childrenOf.has(node.value);
		},
		[hasLoader, loadStates, baseIndex],
	);

	// Levels with pages left, the only ones a resolved chain node is listed in.
	const pagingKey = Array.from(loadStates)
		.filter(([, state]: readonly [string, CascaderLoadState]): boolean => state.hasMore)
		.map(([key]: readonly [string, CascaderLoadState]): string => key)
		.join(PAGING_KEY_SEPARATOR);
	const paging = React.useMemo((): ReadonlySet<string> => new Set(pagingKey === "" ? [] : pagingKey.split(PAGING_KEY_SEPARATOR)), [pagingKey]);

	const { pages, detached, links } = loader.store;
	const index = React.useMemo(
		(): CascaderIndex<CascaderNode<TData>> => mergeCascaderIndex(baseIndex, pages, detached, links, paging),
		[baseIndex, pages, detached, links, paging],
	);

	/** Whether a level needs the paging pseudo-row. Tree has no per-level empty state, so there the row is also the branch's loading and error surface. */
	const needsMoreRow = React.useCallback(
		(key: string, childCount: number): boolean => {
			const state = loadStates.get(key);
			if (state === undefined) {
				return false;
			}
			if (childCount > 0) {
				return state.hasMore || state.loading || state.error;
			}
			return mode === "tree" && (state.loading || state.error);
		},
		[loadStates, mode],
	);

	// Remembers every selected node, so the trigger keeps a label after it leaves the loaded set. Adjusted during render.
	const [labelCache, setLabelCache] = React.useState<ReadonlyMap<string, CascaderNode<TData>>>(new Map());
	const staleLabels = selectedValues.filter((value: string): boolean => {
		const node = index.byValue.get(value);
		return node !== undefined && labelCache.get(value) !== node;
	});
	if (staleLabels.length > 0) {
		const nextCache = new Map(labelCache);
		for (const value of staleLabels) {
			const node = index.byValue.get(value);
			if (node !== undefined) {
				nextCache.set(value, node);
			}
		}
		setLabelCache(nextCache);
	}

	/** The caller's typed node for a value: the index, then a remembered selection, then a synthetic `{ value, label: value }`. */
	const resolveTyped = React.useCallback(
		(value: string): CascaderNode<TData> => index.byValue.get(value) ?? labelCache.get(value) ?? { value, label: value },
		[index, labelCache],
	);
	const toTyped = React.useCallback(
		(node: CascaderNodeBase): CascaderNode<TData> => index.byValue.get(node.value) ?? labelCache.get(node.value) ?? retypeCascaderNode<TData>(node),
		[index, labelCache],
	);
	const resolveNode = React.useCallback((value: string): CascaderNodeBase => resolveTyped(value), [resolveTyped]);

	/* ------------------------------ derived view ----------------------------- */

	const currentParentValue = path.at(-1) ?? null;
	const currentParent = currentParentValue === null ? null : (index.byValue.get(currentParentValue) ?? null);
	const currentLevelKey = currentParentValue ?? CASCADER_ROOT_KEY;

	const isDeepSearching = (searchScope === "deep" || searchScope === "global") && query.trim().length > 0 && mode !== "tree";
	// Global is the same scan from the root, whatever level is on screen.
	const deepSearchWithin = searchScope === "global" ? null : currentParentValue;

	const localDeepResults = React.useMemo((): readonly CascaderNode<TData>[] | null => {
		if (!isDeepSearching) {
			return null;
		}
		return searchCascaderDeep(index, query, { within: deepSearchWithin, matches: filter });
	}, [isDeepSearching, index, query, deepSearchWithin, filter]);

	// Server search wins over the local scan, or each hit shows up twice.
	const deepResults: readonly CascaderNodeBase[] | null = loader.searchResults ?? localDeepResults;

	const levelItems = React.useMemo(
		(): readonly CascaderNode<TData>[] => filterCascaderLevel(getCascaderChildren(index, currentParentValue), query, filter),
		[index, currentParentValue, query, filter],
	);

	/** The active level's rows plus the paging pseudo-row, appended HERE because every index Base UI hands out indexes this array. */
	const levelRendered = React.useMemo((): readonly CascaderNodeBase[] => {
		if (deepResults !== null) {
			return deepResults;
		}
		if (!needsMoreRow(currentLevelKey, levelItems.length)) {
			return levelItems;
		}
		return withCascaderMoreRow(levelItems, createCascaderMoreNode(currentLevelKey, levelItems.length), index.pinned);
	}, [deepResults, levelItems, currentLevelKey, needsMoreRow, index.pinned]);

	// Columns renders the whole trail, but only the deepest column is interactive through Base UI.
	const columns = React.useMemo((): readonly CascaderColumn[] => {
		if (mode !== "columns") {
			return [];
		}
		const trail: CascaderColumn[] = [];
		for (let depth = 0; depth <= path.length; depth += 1) {
			const parentValue = depth === 0 ? null : (path.at(depth - 1) ?? null);
			const parent = parentValue === null ? null : (index.byValue.get(parentValue) ?? null);
			const isActive = depth === path.length;
			let columnItems: readonly CascaderNodeBase[] = levelRendered;
			if (!isActive) {
				// A trail column pages on its own, without losing the columns right of it.
				const key = parentValue ?? CASCADER_ROOT_KEY;
				const columnChildren = getCascaderChildren(index, parentValue);
				columnItems = needsMoreRow(key, columnChildren.length)
					? withCascaderMoreRow(columnChildren, createCascaderMoreNode(key, columnChildren.length), index.pinned)
					: columnChildren;
			}
			// Only the active column is filtered: a query narrows what you type into, never the trail behind it.
			trail.push({ parent, depth, activeValue: path.at(depth) ?? null, active: isActive, items: columnItems });
		}
		return trail;
	}, [mode, path, index, levelRendered, needsMoreRow]);

	// Tree level keys needing a paging pseudo-row; with no per-level empty state, also where a still-loading branch says so.
	const treeSentinels = React.useMemo((): ReadonlySet<string> | undefined => {
		if (mode !== "tree") {
			return undefined;
		}
		const keys = new Set<string>();
		for (const key of [CASCADER_ROOT_KEY, ...expanded]) {
			if (needsMoreRow(key, index.childrenOf.get(key)?.length ?? 0)) {
				keys.add(key);
			}
		}
		return keys.size > 0 ? keys : undefined;
	}, [mode, index, expanded, needsMoreRow]);

	const treeRows = React.useMemo((): readonly CascaderFlatNode[] => {
		if (mode !== "tree") {
			return [];
		}
		const normalized = normalizeCascaderQuery(query);
		if (normalized === "") {
			return flattenCascaderTree(index, expanded, treeSentinels);
		}
		// Matches every node, not just visible rows, and keeps the ancestors, or a hit inside a collapsed branch disappears.
		const keep = new Set<string>();
		const listed = getCascaderListedValues(index);
		const matches = filter ?? matchesCascaderQuery;
		for (const node of index.all) {
			if (listed.has(node.value) && matches(node, normalized)) {
				for (const ancestor of getCascaderPath(index, node.value)) {
					keep.add(ancestor.value);
				}
			}
		}
		// No sentinels while filtering: that page would not have the query applied.
		return flattenCascaderTree(index, new Set([...expanded, ...keep])).filter((row: CascaderFlatNode): boolean => keep.has(row.node.value));
	}, [mode, index, expanded, treeSentinels, query, filter]);

	// What `Combobox.Root` receives. Tree flattens to the same linear list.
	const renderedItems = React.useMemo(
		(): readonly CascaderNodeBase[] => (mode === "tree" ? treeRows.map((row: CascaderFlatNode): CascaderNodeBase => row.node) : levelRendered),
		[mode, treeRows, levelRendered],
	);

	/* ---------------------------- level swap reset --------------------------- */

	/**
	 * Base UI never resets the highlighted index on an `items` change and has no
	 * imperative setter; its one automatic reset is an out-of-range clamp, so a
	 * single empty frame trips it. The frame is armed during render (state) and
	 * released from a layout effect through an external store, so the empty
	 * list commits exactly once and never paints.
	 */
	const levelKey = currentParentValue ?? "";
	const [swap, setSwap] = React.useState({ key: levelKey, seq: 0 });
	if (swap.key !== levelKey) {
		setSwap({ key: levelKey, seq: swap.seq + 1 });
	}
	const [frameStore] = React.useState(createCascaderFrameStore);
	const releasedFrame = React.useSyncExternalStore(frameStore.subscribe, frameStore.getSnapshot, frameStore.getSnapshot);
	const swapping = releasedFrame !== swap.seq;
	React.useLayoutEffect((): void => {
		frameStore.release(swap.seq);
	}, [frameStore, swap.seq]);

	// The same frame on demand, for a navigation that lands on the level already on screen.
	const resetHighlight = React.useCallback((): void => {
		setSwap((previous: { readonly key: string; readonly seq: number }): { key: string; seq: number } => ({ key: previous.key, seq: previous.seq + 1 }));
	}, []);

	/* ----------------------------- virtualization ---------------------------- */

	// A COUNT: columns mounts one per column, and StrictMode remounts effects.
	const [virtualRenderers, setVirtualRenderers] = React.useState(0);
	const registerVirtualRenderer = React.useCallback((): (() => void) => {
		setVirtualRenderers((count: number): number => count + 1);
		return (): void => {
			setVirtualRenderers((count: number): number => Math.max(0, count - 1));
		};
	}, []);

	const hasVirtualRenderer = virtualRenderers > 0;
	const wantsVirtual = virtualize ?? renderedItems.length >= virtualizeThreshold;

	// LATCHED per level: a query narrowing a long level past the threshold must not tear the virtualizer down.
	const [virtualLatch, setVirtualLatch] = React.useState({ key: levelKey, on: false });
	const virtualized = hasVirtualRenderer && (virtualLatch.key === levelKey ? virtualLatch.on || wantsVirtual : wantsVirtual);
	if (!hasVirtualRenderer) {
		if (virtualLatch.on || virtualLatch.key !== levelKey) {
			setVirtualLatch({ key: levelKey, on: false });
		}
	} else if (virtualLatch.key !== levelKey) {
		setVirtualLatch({ key: levelKey, on: virtualized });
	} else if (virtualized && !virtualLatch.on) {
		setVirtualLatch({ key: levelKey, on: true });
	}

	/* ------------------------------ navigation ------------------------------ */

	/** One signal per navigation, feeding the live region. `seq` alternates the invisible marker so two identical announcements are two mutations. */
	const [announceSignal, setAnnounceSignal] = React.useState<CascaderAnnounceSignal>({ seq: 0, toggled: null, notice: null });
	const bumpAnnouncement = React.useCallback((toggled: string | null): void => {
		setAnnounceSignal((previous: CascaderAnnounceSignal): CascaderAnnounceSignal => ({ seq: previous.seq + 1, toggled, notice: null }));
	}, []);
	/** Speaks for interactions that change nothing on screen: a refusal, a cascade sweep. */
	const announceNotice = React.useCallback((notice: string): void => {
		setAnnounceSignal((previous: CascaderAnnounceSignal): CascaderAnnounceSignal => ({ seq: previous.seq + 1, toggled: null, notice }));
	}, []);

	/**
	 * The navigation a press asked for and a fetch has not answered yet. Load
	 * BEFORE you move: the old rows stay and the progress sits on the pressed
	 * row. State for the announcement, mirrored in a ref for the async settle.
	 */
	const [pendingNavigation, setPendingNavigationState] = React.useState<CascaderPendingNavigation | null>(null);
	const pendingRef = React.useRef<CascaderPendingNavigation | null>(null);
	const setPendingNavigation = React.useCallback((next: CascaderPendingNavigation | null): void => {
		pendingRef.current = next;
		setPendingNavigationState(next);
	}, []);

	const requestChildren = React.useCallback(
		(node: CascaderNodeBase, pending: CascaderPendingNavigation): void => {
			setPendingNavigation(pending);
			// Both are called: `retryLevel` no-ops unless the level errored, `ensureLevel` no-ops if it has state.
			retryLevel(node.value);
			ensureLevel(node.value, "level");
			bumpAnnouncement(null);
		},
		[setPendingNavigation, retryLevel, ensureLevel, bumpAnnouncement],
	);

	const isBranch = React.useCallback((node: CascaderNodeBase): boolean => isCascaderBranch(index, node), [index]);
	const isSelectable = React.useCallback((node: CascaderNodeBase): boolean => isCascaderSelectable(index, toTyped(node), selectable), [index, toTyped, selectable]);
	const isDisabled = React.useCallback((node: CascaderNodeBase): boolean => isCascaderDisabled(index, node), [index]);
	// `"leaf"` is the only setting that answers no in advance; a predicate is opaque, so the check gutter is reserved uniformly.
	const branchesSelectable = selectable !== "leaf";

	// Open flyouts, by key. A ref: `handleOpenChange` needs the answer as of the Escape being handled.
	const openFlyoutsRef = React.useRef(new Set<string>());
	const setFlyoutOpen = React.useCallback((key: string, flyoutOpen: boolean): void => {
		if (flyoutOpen) {
			openFlyoutsRef.current.add(key);
		} else {
			openFlyoutsRef.current.delete(key);
		}
	}, []);
	const hasOpenFlyout = React.useCallback((): boolean => openFlyoutsRef.current.size > 0, []);

	const selectedSet = React.useMemo((): ReadonlySet<string> => new Set(selectedValues), [selectedValues]);
	const isSelected = React.useCallback((node: CascaderNodeBase): boolean => selectedSet.has(node.value), [selectedSet]);

	/** Selected-descendant counts, walked ONCE per selection change: up from each selection, not down from each row. */
	const selectedDescendants = React.useMemo((): ReadonlyMap<string, number> => getCascaderSelectedDescendants(index, selectedValues), [index, selectedValues]);
	const selectedDescendantCount = React.useCallback((node: CascaderNodeBase): number => selectedDescendants.get(node.value) ?? 0, [selectedDescendants]);
	// Partial selections read off the SAME map, so the dash and the number cannot drift apart.
	const indeterminateSet = React.useMemo(
		(): ReadonlySet<string> | null => (cascade && multiple ? getCascaderIndeterminateFrom(selectedDescendants, selectedValues) : null),
		[cascade, multiple, selectedDescendants, selectedValues],
	);
	const isIndeterminate = React.useCallback((node: CascaderNodeBase): boolean => indeterminateSet?.has(node.value) === true, [indeterminateSet]);

	// Base UI owns the highlight; mirrored so handlers can read it unsubscribed, and as a store for what must re-render on it.
	const highlightedRef = React.useRef<CascaderNodeBase | null>(null);
	const getHighlighted = React.useCallback((): CascaderNodeBase | null => highlightedRef.current, []);
	const [highlightStore] = React.useState<CascaderHighlightStore>(createCascaderHighlightStore);

	/* ------------------------------ announcement ---------------------------- */

	const currentLoadState = loadStates.get(currentLevelKey) ?? null;
	const searchLoadState = loader.searchState;
	const livePending = open || inline ? pendingNavigation : null;

	/** What the query announcement COUNTS: matches, not rows. Server hits count as-is. */
	const announcedMatches = React.useMemo((): number => {
		if (deepResults !== null) {
			return deepResults.length;
		}
		const normalized = normalizeCascaderQuery(query);
		if (normalized === "") {
			return 0;
		}
		const matches = filter ?? matchesCascaderQuery;
		return renderedItems.filter((node: CascaderNodeBase): boolean => !isCascaderMoreNode(node) && matches(toTyped(node), normalized)).length;
	}, [deepResults, renderedItems, query, filter, toTyped]);

	// Real rows only: a tree's first load renders its loading row.
	const hasRows = renderedItems.some((node: CascaderNodeBase): boolean => !isCascaderMoreNode(node));

	const announcementTarget = React.useMemo((): CascaderAnnouncement => {
		// An INLINE cascader is never "open", so `open` alone would silence its tree.
		if (!open && !inline) {
			return { text: "", defer: false };
		}
		const total = renderedItems.length;
		const marker = ANNOUNCE_MARKER.repeat(announceSignal.seq % 2);

		// A notice outranks everything below: it exists because nothing else on screen changed.
		if (announceSignal.notice !== null) {
			return { text: `${announceSignal.notice}${marker}`, defer: false };
		}

		const toggled = mode === "tree" && announceSignal.toggled !== null ? (index.byValue.get(announceSignal.toggled) ?? null) : null;
		const pendingState = livePending === null ? null : (loadStates.get(livePending.value) ?? null);
		const searching = query.trim() !== "";
		const levelState = searching ? searchLoadState : currentLoadState;

		let text: string;
		let defer = false;
		if (pendingState?.error === true) {
			text = labels.error;
		} else if (livePending !== null) {
			// The rows on screen belong to the level being left behind, so this is always the FIRST-page string.
			text = labels.loading;
		} else if (levelState?.error === true) {
			text = labels.error;
		} else if (levelState?.loading === true) {
			text = searching ? labels.searchingAnnouncement : hasRows ? labels.loadingMore : labels.loading;
		} else if (searching) {
			text = announcedMatches === 0 ? labels.empty : labels.resultsAnnouncement(announcedMatches);
			defer = true;
		} else if (toggled !== null) {
			text = expanded.has(toggled.value) ? labels.expandedAnnouncement(toggled.label, getCascaderCount(index, toggled)) : labels.collapsedAnnouncement(toggled.label);
		} else if (currentParent !== null) {
			// `path.length + 1` matches tree mode's `aria-level`: the rows are the parent's CHILDREN.
			text = labels.levelAnnouncement(currentParent.label, path.length + 1, total);
		} else {
			text = labels.rootAnnouncement(total);
		}

		return { text: `${text}${marker}`, defer };
	}, [
		open,
		inline,
		mode,
		index,
		expanded,
		announceSignal,
		query,
		labels,
		renderedItems.length,
		hasRows,
		announcedMatches,
		currentParent,
		path.length,
		currentLoadState,
		searchLoadState,
		livePending,
		loadStates,
	]);

	/** The COMMITTED announcement. Immediate texts commit during render; only the deferred query count waits for the timer. */
	const [announced, setAnnounced] = React.useState<CascaderAnnouncement>(announcementTarget);
	if (!announcementTarget.defer && announced.text !== announcementTarget.text) {
		setAnnounced(announcementTarget);
	}
	React.useEffect((): (() => void) | undefined => {
		if (!announcementTarget.defer) {
			return undefined;
		}
		const timer = setTimeout((): void => {
			setAnnounced(announcementTarget);
		}, CASCADER_ANNOUNCE_DEBOUNCE_MS);
		return (): void => {
			clearTimeout(timer);
		};
	}, [announcementTarget]);

	/* --------------------------------- state -------------------------------- */

	const stateValue = React.useMemo(
		(): CascaderStateContextValue => ({
			index,
			path,
			expanded,
			query,
			currentParent,
			levelItems,
			deepResults,
			renderedItems,
			columns,
			treeRows,
			selectedValues,
			selectedDescendants,
			loadStates,
			searchState: searchLoadState,
			announcement: announced.text,
		}),
		[
			index,
			path,
			expanded,
			query,
			currentParent,
			levelItems,
			deepResults,
			renderedItems,
			columns,
			treeRows,
			selectedValues,
			selectedDescendants,
			loadStates,
			searchLoadState,
			announced.text,
		],
	);

	/* ------------------------------ latest props ---------------------------- */

	/**
	 * Latest committed props and derived state, WRITTEN IN AN EFFECT, which keeps
	 * the callbacks below stable for the life of the cascader. ONLY event
	 * handlers read it; anything used during render is memoised instead.
	 */
	const latest = React.useRef<CascaderLatest<TData>>({
		index,
		state: stateValue,
		mode,
		multiple,
		cascade,
		max,
		labels,
		closeOnSelect,
		selectedValues,
		path,
		expandedList,
		deepResults,
		emitValue,
		resolveTyped,
		isSelectable,
		needsChildren,
		expanded,
	});
	React.useEffect((): void => {
		latest.current = {
			index,
			state: stateValue,
			mode,
			multiple,
			cascade,
			max,
			labels,
			closeOnSelect,
			selectedValues,
			path,
			expandedList,
			deepResults,
			emitValue,
			resolveTyped,
			isSelectable,
			needsChildren,
			expanded,
		};
	});

	const getIndex = React.useCallback((): CascaderIndex => latest.current.index, []);
	const getState = React.useCallback((): CascaderStateContextValue => latest.current.state, []);

	const pushLevel = React.useCallback(
		(nodeValue: string): void => {
			setPathWithReason([...latest.current.path, nodeValue], "drill");
			setQuery("");
			bumpAnnouncement(null);
		},
		[setPathWithReason, setQuery, bumpAnnouncement],
	);

	const popLevel = React.useCallback((): void => {
		const current = latest.current.path;
		if (current.length > 0) {
			setPathWithReason(current.slice(0, -1), "back");
		}
		setQuery("");
		// Going BACK abandons a held navigation, or an in-flight branch drills in long after the user moved on.
		setPendingNavigation(null);
		bumpAnnouncement(null);
	}, [setPathWithReason, setQuery, setPendingNavigation, bumpAnnouncement]);

	const goToDepth = React.useCallback(
		(depth: number): void => {
			setPathWithReason(latest.current.path.slice(0, Math.max(0, depth)), "breadcrumb");
			setQuery("");
			setPendingNavigation(null);
			bumpAnnouncement(null);
		},
		[setPathWithReason, setQuery, setPendingNavigation, bumpAnnouncement],
	);

	const toggleExpanded = React.useCallback(
		(nodeValue: string): void => {
			const current = latest.current.expandedList;
			setExpandedList(current.includes(nodeValue) ? current.filter((value: string): boolean => value !== nodeValue) : [...current, nodeValue], null);
			bumpAnnouncement(nodeValue);
		},
		[setExpandedList, bumpAnnouncement],
	);

	const goToLevelAt = React.useCallback(
		(nodeValue: string, depth: number): void => {
			setPathWithReason([...latest.current.path.slice(0, Math.max(0, depth)), nodeValue], "drill");
			setQuery("");
			bumpAnnouncement(null);
		},
		[setPathWithReason, setQuery, bumpAnnouncement],
	);

	const goToTrail = React.useCallback(
		(trail: readonly string[]): void => {
			// A global hit can BE the level on screen: then nothing moved, and only the highlight needs its reset.
			if (sameValues(trail, latest.current.path)) {
				resetHighlight();
			} else {
				setPathWithReason(trail, "drill");
			}
			setQuery("");
			bumpAnnouncement(null);
		},
		[setPathWithReason, resetHighlight, setQuery, bumpAnnouncement],
	);

	const navigateAt = React.useCallback(
		(node: CascaderNodeBase, depth: number): void => {
			if (isCascaderDisabled(latest.current.index, node)) {
				return;
			}
			if (latest.current.mode === "tree") {
				toggleExpanded(node.value);
				return;
			}
			if (latest.current.needsChildren(node)) {
				requestChildren(node, { value: node.value, kind: "at", depth });
				return;
			}
			goToLevelAt(node.value, depth);
		},
		[toggleExpanded, goToLevelAt, requestChildren],
	);

	const navigate = React.useCallback(
		(node: CascaderNodeBase): void => {
			const { mode: currentMode, deepResults: currentDeepResults, index: currentIndex, expanded: currentExpanded, needsChildren: pending } = latest.current;
			// Every drill and expand passes here, so this is where a disabled subtree stays shut.
			if (isCascaderDisabled(currentIndex, node)) {
				return;
			}
			if (currentMode === "tree") {
				// Collapsing never needs data. Opening waits WITHOUT expanding.
				if (!currentExpanded.has(node.value) && pending(node)) {
					requestChildren(node, { value: node.value, kind: "expand" });
					return;
				}
				toggleExpanded(node.value);
				return;
			}
			// A search hit sits at any depth, so drilling in swaps in the hit's own trail.
			if (currentDeepResults !== null) {
				const trail = getCascaderPath(currentIndex, node.value).map((entry: CascaderNode<TData>): string => entry.value);
				if (pending(node)) {
					requestChildren(node, { value: node.value, kind: "trail", trail });
					return;
				}
				goToTrail(trail);
				return;
			}
			if (pending(node)) {
				requestChildren(node, { value: node.value, kind: "push" });
				return;
			}
			pushLevel(node.value);
		},
		[toggleExpanded, goToTrail, pushLevel, requestChildren],
	);

	/**
	 * The other half of `requestChildren`: the fetch landed, so the held
	 * navigation happens. On failure nothing moves and the intent is KEPT, which
	 * is what makes the row's retry affordance mean something.
	 */
	const settlePending = React.useCallback(
		(key: string): void => {
			const pending = pendingRef.current;
			if (pending?.value !== key) {
				return;
			}
			setPendingNavigation(null);
			const target = latest.current.index.byValue.get(pending.value);
			if (target !== undefined && isCascaderDisabled(latest.current.index, target)) {
				return;
			}
			switch (pending.kind) {
				case "expand":
					toggleExpanded(pending.value);
					return;
				case "trail":
					goToTrail(pending.trail);
					return;
				case "at":
					goToLevelAt(pending.value, pending.depth);
					return;
				case "push":
					pushLevel(pending.value);
					return;
			}
		},
		[setPendingNavigation, toggleExpanded, goToTrail, goToLevelAt, pushLevel],
	);
	React.useEffect((): void => {
		settleRef.current = settlePending;
	}, [settlePending]);

	/* ------------------------------- selection ------------------------------ */

	// The one place the selection changes, so `onValueChange` reports the same shape whatever caused it.
	const emitSelection = React.useCallback(
		(nextValues: readonly string[], node: CascaderNodeBase | null, reason: CascaderChangeReason): void => {
			const { selectedValues: current, multiple: currentMultiple, emitValue: emit, index: currentIndex, resolveTyped: resolve } = latest.current;
			const next = currentMultiple ? nextValues : nextValues.slice(0, 1);
			if (sameValues(next, current)) {
				return;
			}
			setSelectedValues(next, null);
			const typedNode = node === null ? null : resolve(node.value);
			const chain = typedNode === null ? [] : getCascaderPath(currentIndex, typedNode.value);
			// A node absent from `items` has no chain, so fall back to the node rather than report an empty path.
			const detailsPath = typedNode === null ? [] : chain.length > 0 ? chain : [typedNode];
			emit(next, { node: typedNode, path: detailsPath, nodes: next.map(resolve), reason });
		},
		[setSelectedValues],
	);

	const setSelection = React.useCallback(
		(values: readonly string[], reason?: CascaderChangeReason): void => {
			const { selectedValues: current, resolveTyped: resolve } = latest.current;
			if (reason === "clear") {
				emitSelection(values, null, "clear");
				return;
			}
			const before = new Set(current);
			const after = new Set(values);
			const added = values.find((entry: string): boolean => !before.has(entry));
			if (added !== undefined) {
				emitSelection(values, resolve(added), reason ?? "select");
				return;
			}
			const removed = current.find((entry: string): boolean => !after.has(entry));
			if (removed !== undefined) {
				emitSelection(values, resolve(removed), reason ?? "deselect");
				return;
			}
			emitSelection(values, null, reason ?? "select");
		},
		[emitSelection],
	);

	const commit = React.useCallback(
		(node: CascaderNodeBase): void => {
			const {
				multiple: currentMultiple,
				cascade: currentCascade,
				selectedValues: current,
				max: currentMax,
				index: currentIndex,
				isSelectable: currentIsSelectable,
				labels: currentLabels,
				closeOnSelect: currentCloseOnSelect,
			} = latest.current;

			// Refuses a SELECT, never a removal: a disabled value set from outside must stay removable.
			const selecting = !currentMultiple || !current.includes(node.value);
			if (selecting && isCascaderDisabled(currentIndex, node)) {
				return;
			}

			if (!currentMultiple) {
				emitSelection([node.value], node, "select");
				if (currentCloseOnSelect) {
					setPendingNavigation(null);
					setOpenWithReason(false, "item-press");
				} else {
					setQuery("");
				}
				return;
			}

			if (currentCascade) {
				const next = applyCascadeSelection(currentIndex, current, node.value, selecting, currentIsSelectable);
				// `max` caps the whole gesture rather than truncating it.
				if (selecting && currentMax !== undefined && next.length > currentMax && next.length > current.length) {
					announceNotice(currentLabels.maxReachedAnnouncement(currentMax));
					return;
				}
				emitSelection(next, node, selecting ? "select" : "deselect");
				// How many values the closure swept along is invisible from the one row pressed.
				const before = new Set(current);
				const after = new Set(next);
				const swept = (selecting ? next : current).filter((entry: string): boolean => entry !== node.value && (selecting ? !before.has(entry) : !after.has(entry))).length;
				if (swept > 0) {
					announceNotice(currentLabels.cascadeAnnouncement(node.label, swept, selecting));
				}
				setQuery("");
				return;
			}

			if (current.includes(node.value)) {
				emitSelection(
					current.filter((value: string): boolean => value !== node.value),
					node,
					"deselect",
				);
			} else if (currentMax === undefined || current.length < currentMax) {
				emitSelection([...current, node.value], node, "select");
			} else {
				announceNotice(currentLabels.maxReachedAnnouncement(currentMax));
			}
			setQuery("");
		},
		[emitSelection, setPendingNavigation, setOpenWithReason, setQuery, announceNotice],
	);

	/** Safety net for paths that bypass the row-level veto (the drag-select mouseup). `details.cancel()` suppresses the commit and the close together. */
	const handleComboboxValueChange = React.useCallback(
		(next: CascaderNodeBase | CascaderNodeBase[] | null, details: ComboboxPrimitive.Root.ChangeEventDetails): void => {
			if (!multiple) {
				const node = isNodeList(next) ? (next.at(0) ?? null) : next;
				if (node === null) {
					return;
				}
				// The paging row is a real option, so Base UI reports it as a selection; a disabled row only gets here around the row.
				if (isCascaderMoreNode(node) || isDisabled(node)) {
					details.cancel();
					return;
				}
				if (!isSelectable(node) && isBranch(node)) {
					details.cancel();
					navigate(node);
					return;
				}
				// `closeOnSelect={false}` must also stop Base UI's OWN close; one shared details object, so cancelling suppresses both.
				if (!closeOnSelect) {
					details.cancel();
				}
				commit(node);
				return;
			}

			// Take Base UI's whole array as the answer and inspect only what was ADDED.
			const nextNodes = isNodeList(next) ? next : NO_NODES;
			const added = nextNodes.find((node: CascaderNodeBase): boolean => !selectedSet.has(node.value));
			if (added !== undefined && (isCascaderMoreNode(added) || isDisabled(added))) {
				details.cancel();
				return;
			}
			if (added !== undefined && !isSelectable(added) && isBranch(added)) {
				details.cancel();
				navigate(added);
				return;
			}
			// Cascading reads Base UI's array only as the REPORT of which row was pressed.
			if (cascade) {
				const nextValues = new Set(nextNodes.map((node: CascaderNodeBase): string => node.value));
				const removed = selectedValues.find((entry: string): boolean => !nextValues.has(entry));
				const toggled = added ?? (removed === undefined ? null : resolveNode(removed));
				if (toggled !== null) {
					commit(toggled);
				}
				return;
			}
			if (max !== undefined && nextNodes.length > selectedValues.length && nextNodes.length > max) {
				details.cancel();
				announceNotice(labels.maxReachedAnnouncement(max));
				return;
			}
			setSelection(nextNodes.map((node: CascaderNodeBase): string => node.value));
			setQuery("");
		},
		[
			multiple,
			selectedSet,
			selectedValues,
			max,
			cascade,
			closeOnSelect,
			labels,
			announceNotice,
			isSelectable,
			isDisabled,
			isBranch,
			navigate,
			commit,
			resolveNode,
			setSelection,
			setQuery,
		],
	);

	const handleOpenChange = React.useCallback(
		(nextOpen: boolean, details: ComboboxPrimitive.Root.ChangeEventDetails): void => {
			if (details.isCanceled) {
				return;
			}
			// Escape closes ONE popup at a time: a footer flyout first.
			if (!nextOpen && details.reason === "escape-key" && hasOpenFlyout()) {
				details.cancel();
				return;
			}
			setOpenWithReason(nextOpen, details.reason);
			if (!nextOpen) {
				// A popup that closes mid-flight must not drill in when the answer arrives.
				setPendingNavigation(null);
				setQuery("");
				return;
			}
			// Opening onto the level holding the selection is the difference between "edit this" and "start over".
			if (revealSelected) {
				setQuery("");
				const [first] = latest.current.selectedValues;
				if (mode !== "tree") {
					const revealed =
						first === undefined
							? NO_VALUES
							: getCascaderPath(latest.current.index, first)
									.slice(0, -1)
									.map((node: CascaderNode<TData>): string => node.value);
					setPathWithReason(revealed, "reveal");
				}
			}
		},
		[hasOpenFlyout, setOpenWithReason, setPendingNavigation, setQuery, revealSelected, mode, setPathWithReason],
	);

	const handleInputValueChange = React.useCallback(
		(next: string): void => {
			setQuery(next);
		},
		[setQuery],
	);

	const handleItemHighlighted = React.useCallback(
		(item: CascaderNodeBase | undefined, details: ComboboxPrimitive.Root.HighlightEventDetails): void => {
			// Fires on every arrow key AND every pointer move, so it never calls setState.
			highlightedRef.current = item ?? null;
			highlightStore.set(item === undefined ? CASCADER_NO_HIGHLIGHT : { index: details.index, value: item.value });
			prefetchNode(item === undefined ? null : toTyped(item));
		},
		[highlightStore, prefetchNode, toTyped],
	);

	/* -------------------------------- context ------------------------------- */

	// Render props re-resolve the payload-free row node into the caller's typed node.
	const renderContext = React.useMemo((): CascaderRenderContextValue => {
		const retypeState = (state: CascaderItemState): CascaderItemState<CascaderNode<TData>> => ({ ...state, path: state.path.map(toTyped) });
		const wrap = (render: CascaderBaseProps<TData>["renderItem"]): CascaderRenderNode | undefined =>
			render === undefined ? undefined : (node: CascaderNodeBase, state: CascaderItemState): React.ReactNode => render(toTyped(node), retypeState(state));
		return { renderItem: wrap(renderItem), renderLabel: wrap(renderLabel) };
	}, [renderItem, renderLabel, toTyped]);

	/** The stable half: nothing in these deps moves on a keystroke, a level change or a highlight. */
	const actionsValue = React.useMemo(
		(): CascaderActionsContextValue => ({
			index,
			mode,
			size,
			multiple,
			cascade,
			branchesSelectable,
			indicator,
			expandTrigger,
			actions,
			searchScope,
			maxHeight,
			inline,
			invalid,
			disabled,
			loading,
			baseId,
			labels,
			virtualized,
			registerVirtualRenderer,
			virtualize,
			virtualizeThreshold,
			estimateRowSize,
			overscan,
			hasLoader,
			loadMore,
			retryLevel,
			retrySearch,
			invalidateLevel,
			getIndex,
			getState,
			getHighlighted,
			setPath,
			pushLevel,
			popLevel,
			goToDepth,
			toggleExpanded,
			setFlyoutOpen,
			hasOpenFlyout,
			setQuery,
			setSelection,
			commit,
			navigate,
			navigateAt,
			resolveNode,
			isBranch,
			isSelectable,
			isDisabled,
			isSelected,
			isIndeterminate,
			selectedDescendantCount,
		}),
		[
			index,
			mode,
			size,
			multiple,
			cascade,
			branchesSelectable,
			indicator,
			expandTrigger,
			actions,
			searchScope,
			maxHeight,
			inline,
			invalid,
			disabled,
			loading,
			baseId,
			labels,
			virtualized,
			registerVirtualRenderer,
			virtualize,
			virtualizeThreshold,
			estimateRowSize,
			overscan,
			hasLoader,
			loadMore,
			retryLevel,
			retrySearch,
			invalidateLevel,
			getIndex,
			getState,
			getHighlighted,
			setPath,
			pushLevel,
			popLevel,
			goToDepth,
			toggleExpanded,
			setFlyoutOpen,
			hasOpenFlyout,
			setQuery,
			setSelection,
			commit,
			navigate,
			navigateAt,
			resolveNode,
			isBranch,
			isSelectable,
			isDisabled,
			isSelected,
			isIndeterminate,
			selectedDescendantCount,
		],
	);

	const comboboxItems = React.useMemo((): CascaderNodeBase[] => [...renderedItems], [renderedItems]);
	const comboboxValue = React.useMemo((): CascaderNodeBase | CascaderNodeBase[] | null => {
		if (multiple) {
			return selectedValues.map(resolveNode);
		}
		const [only] = selectedValues;
		return only === undefined ? null : resolveNode(only);
	}, [multiple, selectedValues, resolveNode]);

	return (
		<CascaderActionsContext.Provider value={actionsValue}>
			<CascaderStateContext.Provider value={stateValue}>
				<CascaderHighlightContext.Provider value={highlightStore}>
					<CascaderRenderContext.Provider value={renderContext}>
						<ComboboxPrimitive.Root<CascaderNodeBase, boolean>
							items={comboboxItems}
							// The empty frame that resets the highlight. See "level swap reset".
							filteredItems={swapping ? NO_NODES : comboboxItems}
							// Filtering is ours: the level, deep and global scopes cannot be expressed through Base UI's single matcher.
							filter={null}
							value={comboboxValue}
							onValueChange={handleComboboxValueChange}
							open={open}
							onOpenChange={handleOpenChange}
							inputValue={query}
							onInputValueChange={handleInputValueChange}
							multiple={multiple}
							disabled={disabled}
							name={name}
							form={form}
							id={id}
							required={required}
							readOnly={readOnly}
							inputRef={inputRef}
							inline={inline}
							// Stops Base UI rendering its composite list, which is what makes an explicit row `index` legal.
							virtualized={virtualized}
							itemToStringValue={itemToStringValue}
							itemToStringLabel={itemToStringLabel}
							isItemEqualToValue={isItemEqualToValue}
							onItemHighlighted={handleItemHighlighted}>
							{children}
						</ComboboxPrimitive.Root>
					</CascaderRenderContext.Provider>
				</CascaderHighlightContext.Provider>
			</CascaderStateContext.Provider>
		</CascaderActionsContext.Provider>
	);
}

/* -------------------------------------------------------------------------- */
/*                                   Trigger                                  */
/* -------------------------------------------------------------------------- */

/**
 * The trigger surface. `default` is the kit's field look; `plain` keeps only the
 * icon sizing and the state treatment, for a trigger that renders through
 * another control (`render={<Button variant="outline" />}`), which it becomes
 * automatically when `render` is passed.
 */
export const cascaderTriggerVariants = cva("[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", {
	variants: {
		variant: {
			default:
				"group/cascader-trigger flex items-center justify-between gap-1.5 rounded-md border border-input bg-transparent px-2.5 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50",
			plain: "",
		},
		size: { sm: "", default: "", lg: "" },
		state: fieldStateVariants.state,
	},
	compoundVariants: [
		{ variant: "default", size: "sm", className: "h-8" },
		{ variant: "default", size: "default", className: "h-9" },
		{ variant: "default", size: "lg", className: "h-10" },
	],
	defaultVariants: { variant: "default", size: "default", state: "default" },
});

export type CascaderTriggerVariant = "default" | "plain";

export interface CascaderTriggerProps extends ComboboxPrimitive.Trigger.Props {
	/** Hides the trailing chevron, for a trigger that supplies its own. */
	readonly showIcon?: boolean | undefined;
	readonly variant?: CascaderTriggerVariant | undefined;
}

const TRIGGER_ICON = <ChevronDownIcon aria-hidden className="pointer-events-none size-4 shrink-0 text-muted-foreground" />;

/** The popup trigger. Its contents are the field's VALUE, so give it a name (`aria-label`, or a `<label htmlFor>` on its `id`). */
const CascaderTrigger = React.forwardRef<HTMLButtonElement, CascaderTriggerProps>(function CascaderTrigger(
	{ className, children, showIcon = true, variant, render, disabled: disabledProp, ...props },
	ref,
): React.JSX.Element {
	const { invalid, disabled: rootDisabled, loading, size } = useCascaderActions();
	const disabled = disabledProp ?? rootDisabled;
	const state = resolveFieldState({ disabled, loading, ariaInvalid: invalid ? true : undefined });
	const resolvedVariant = variant ?? (render === undefined ? "default" : "plain");

	return (
		<ComboboxPrimitive.Trigger
			ref={ref}
			data-slot="cascader-trigger"
			render={render}
			disabled={disabled}
			aria-invalid={invalid ? true : undefined}
			aria-busy={loading ? true : undefined}
			data-invalid={invalid ? "" : undefined}
			className={cn(cascaderTriggerVariants({ variant: resolvedVariant, size, state }), className)}
			{...props}>
			{children}
			{showIcon ? TRIGGER_ICON : null}
		</ComboboxPrimitive.Trigger>
	);
});

/* -------------------------------------------------------------------------- */
/*                                    Chips                                   */
/* -------------------------------------------------------------------------- */

/** Ref for the chips container: they replace the trigger, so the popup is anchored to them. Hand it to `CascaderContent`'s `anchor`. */
export function useCascaderAnchor(): React.RefObject<HTMLDivElement | null> {
	return React.useRef<HTMLDivElement | null>(null);
}

export const cascaderChipsVariants = cva(
	"flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent bg-clip-padding px-2.5 py-1.5 text-sm shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 has-data-[slot=cascader-chip]:px-1.5 dark:bg-input/30",
	{
		variants: {
			variant: { default: "" },
			size: { sm: "min-h-8", default: "min-h-9", lg: "min-h-10" },
			state: fieldStateVariants.state,
		},
		defaultVariants: { variant: "default", size: "default", state: "default" },
	},
);

export interface CascaderChipsProps extends Omit<ComboboxPrimitive.Chips.Props, "children"> {
	/** Shown in place of the chips when nothing is selected. */
	readonly placeholder?: React.ReactNode;
	/** How a `cascade` selection is condensed into chips. DISPLAY ONLY: the stored value stays the full closure. */
	readonly strategy?: CascaderCheckedStrategy | undefined;
	/** Replaces the chip list, receiving the resolved selection IN SELECTION ORDER (Base UI removes a chip by position). */
	readonly children?: React.ReactNode | ((nodes: readonly CascaderNodeBase[]) => React.ReactNode);
}

function isChipsRenderer(children: CascaderChipsProps["children"]): children is (nodes: readonly CascaderNodeBase[]) => React.ReactNode {
	return isFunctionValue(children);
}

/**
 * The multi-select trigger surface: one removable chip per selection. The
 * popup anchors to the chips, every remove button is named, and labels that
 * collide across branches show their path.
 */
const CascaderChips = React.forwardRef<HTMLDivElement, CascaderChipsProps>(function CascaderChips(
	{ className, children, placeholder, strategy = "all", ...props },
	ref,
): React.JSX.Element {
	const { labels, invalid, disabled, loading, size, resolveNode, index, isSelectable, setSelection } = useCascaderActions();
	const { selectedValues } = useCascaderState();
	const state = resolveFieldState({ disabled, loading, ariaInvalid: invalid ? true : undefined });

	// DERIVED display: the selection stays the full closure, the chips condense.
	const displayedValues = strategy === "all" ? selectedValues : getCascaderCheckedValues(index, selectedValues, strategy);
	const nodes = displayedValues.map(resolveNode);
	const ambiguous = findAmbiguousCascaderLabels(nodes);

	// Removal for a CONDENSED chip: Base UI's positional removal is wrong once the chips are fewer, so this removes the chip's closure.
	const removeClosure = React.useCallback(
		(node: CascaderNodeBase): void => {
			setSelection(applyCascadeSelection(index, selectedValues, node.value, false, isSelectable), "deselect");
		},
		[setSelection, index, selectedValues, isSelectable],
	);

	const content = isChipsRenderer(children) ? children(nodes) : children;

	return (
		<ComboboxPrimitive.Chips
			ref={ref}
			data-slot="cascader-chips"
			// An unnamed `role="toolbar"` announces as just "toolbar".
			aria-label={labels.chipsLabel}
			aria-invalid={invalid ? true : undefined}
			data-invalid={invalid ? "" : undefined}
			className={cn(cascaderChipsVariants({ size, state }), className)}
			{...props}>
			{content ??
				(nodes.length === 0 ? (
					<span data-slot="cascader-chips-placeholder" className="truncate text-muted-foreground">
						{placeholder}
					</span>
				) : (
					nodes.map((node: CascaderNodeBase): React.JSX.Element => (
						<CascaderChip key={node.value} node={node} showPath={ambiguous.has(node.value)} onRemove={strategy === "all" ? undefined : removeClosure} />
					))
				))}
		</ComboboxPrimitive.Chips>
	);
});

export interface CascaderChipProps extends Omit<ComboboxPrimitive.Chip.Props, "children"> {
	readonly node: CascaderNodeBase;
	/** Prefix the label with its ancestor trail. */
	readonly showPath?: boolean | undefined;
	/** Trail segments to show, the node itself included. */
	readonly maxSegments?: number | undefined;
	/** Hides the remove button, for a read-only chip. */
	readonly showRemove?: boolean | undefined;
	/** Replaces Base UI's positional removal for this chip (remove button and Backspace/Delete), given the chip's node. */
	readonly onRemove?: ((node: CascaderNodeBase) => void) | undefined;
	/** Replaces the chip's label. The remove button is still rendered. */
	readonly children?: React.ReactNode;
}

type CascaderChipKeyEvent = Parameters<NonNullable<ComboboxPrimitive.Chip.Props["onKeyDown"]>>[0];
type CascaderChipRemoveClickEvent = Parameters<NonNullable<ComboboxPrimitive.ChipRemove.Props["onClick"]>>[0];

/** Trail segments a chip's path keeps by default, itself included. */
const CHIP_PATH_SEGMENTS = 2;

const CHIP_REMOVE_ICON = <XIcon aria-hidden className="pointer-events-none size-3" />;

/** One chip. Removal goes through Base UI's `ChipRemove`, which reports the shortened selection to the root. */
const CascaderChip = React.forwardRef<HTMLDivElement, CascaderChipProps>(function CascaderChip(
	{ className, node, showPath = false, maxSegments = CHIP_PATH_SEGMENTS, showRemove = true, onRemove, onKeyDown, children, ...props },
	ref,
): React.JSX.Element {
	const { labels, index } = useCascaderActions();

	const chain = showPath ? getCascaderPath(index, node.value) : [];
	const segments = collapseCascaderPath(chain, { maxSegments, collapse: "start" });
	const label =
		segments.length > 0
			? segments.map((segment: CascaderPathSegment): string => (segment.type === "node" ? segment.node.label : "…")).join(` ${labels.pathSeparator} `)
			: node.label;

	// Keyboard half of `onRemove`: Base UI's chip removes ITSELF by position on Backspace/Delete. The veto runs first.
	const handleKeyDown = React.useCallback(
		(event: CascaderChipKeyEvent): void => {
			onKeyDown?.(event);
			if (onRemove === undefined || (event.key !== "Backspace" && event.key !== "Delete")) {
				return;
			}
			event.preventBaseUIHandler();
			onRemove(node);
		},
		[onKeyDown, onRemove, node],
	);

	const handleRemoveClick = React.useCallback(
		(event: CascaderChipRemoveClickEvent): void => {
			if (onRemove === undefined) {
				return;
			}
			event.preventBaseUIHandler();
			onRemove(node);
		},
		[onRemove, node],
	);

	return (
		<ComboboxPrimitive.Chip
			ref={ref}
			data-slot="cascader-chip"
			onKeyDown={handleKeyDown}
			className={cn(
				"flex h-5.5 w-fit items-center justify-center gap-1 rounded-sm bg-muted px-1.5 text-xs font-medium whitespace-nowrap text-foreground has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-disabled:opacity-50 has-data-[slot=cascader-chip-remove]:pe-0",
				className,
			)}
			{...props}>
			{children ?? <span className="truncate">{label}</span>}
			{showRemove ? (
				<ComboboxPrimitive.ChipRemove
					data-slot="cascader-chip-remove"
					// Named after what the chip DISPLAYS, or two disambiguated chips both announce the same name.
					aria-label={labels.removeChip(label)}
					onClick={handleRemoveClick}
					className="-ms-1 rounded-sm opacity-50 hover:opacity-100">
					{CHIP_REMOVE_ICON}
				</ComboboxPrimitive.ChipRemove>
			) : null}
		</ComboboxPrimitive.Chip>
	);
});

/* -------------------------------------------------------------------------- */
/*                                   Content                                  */
/* -------------------------------------------------------------------------- */

export interface CascaderContentProps
	extends
		ComboboxPrimitive.Popup.Props,
		Pick<
			ComboboxPrimitive.Positioner.Props,
			"side" | "align" | "sideOffset" | "alignOffset" | "anchor" | "collisionBoundary" | "collisionPadding" | "sticky" | "positionMethod"
		>,
		Pick<ComboboxPrimitive.Portal.Props, "container"> {}

const CONTENT_SURFACE_CLASS =
	"group/combobox-content relative flex max-h-(--available-height) max-w-(--available-width) min-w-(--anchor-width) origin-(--transform-origin) flex-col overflow-hidden rounded-md bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-start-2 data-[side=inline-start]:slide-in-from-end-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95";

/** Gap between the trigger and the popup, in pixels. */
const CONTENT_SIDE_OFFSET_PX = 6;

/**
 * Portal + Positioner + floating panel. Unlike the kit's `ComboboxContent` it
 * does NOT clamp the popup to the anchor width: a cascader panel is routinely wider.
 */
const CascaderContent = React.forwardRef<HTMLDivElement, CascaderContentProps>(function CascaderContent(
	{
		className,
		side = "bottom",
		sideOffset = CONTENT_SIDE_OFFSET_PX,
		align = "start",
		alignOffset = 0,
		anchor,
		collisionBoundary,
		collisionPadding,
		sticky,
		positionMethod,
		container,
		...props
	},
	ref,
): React.JSX.Element {
	const { labels } = useCascaderActions();
	const popupRef = React.useRef<HTMLDivElement | null>(null);
	const setPopup = React.useCallback(
		(element: HTMLDivElement | null): void => {
			popupRef.current = element;
			assignRef(ref, element);
		},
		[ref],
	);

	/** Focus goes to the search field, where the level keys and `aria-activedescendant` live. Touch is handed back to Base UI. */
	const initialFocus = React.useCallback((openType: string): HTMLElement | boolean => {
		const popup = popupRef.current;
		if (popup === null) {
			return true;
		}
		if (openType === "touch") {
			return popup;
		}
		return popup.querySelector<HTMLElement>('[data-slot="cascader-input"]') ?? true;
	}, []);

	return (
		<ComboboxPrimitive.Portal container={container}>
			<ComboboxPrimitive.Positioner
				side={side}
				sideOffset={sideOffset}
				align={align}
				alignOffset={alignOffset}
				anchor={anchor}
				collisionBoundary={collisionBoundary}
				collisionPadding={collisionPadding}
				sticky={sticky}
				positionMethod={positionMethod}
				className="isolate z-popover">
				<ComboboxPrimitive.Popup
					ref={setPopup}
					data-slot="cascader-content"
					// The input inside makes this a `role="dialog"`, unnamed by default.
					aria-label={labels.panelLabel}
					initialFocus={initialFocus}
					className={cn(CONTENT_SURFACE_CLASS, className)}
					{...props}
				/>
			</ComboboxPrimitive.Positioner>
		</ComboboxPrimitive.Portal>
	);
});

/* -------------------------------------------------------------------------- */
/*                                    Panel                                   */
/* -------------------------------------------------------------------------- */

export type CascaderPanelProps = useRender.ComponentProps<"div">;

/**
 * The nav + list(s) + footer container: inside `CascaderContent` for the popup
 * case, alone for the embedded one. Owns the panel's TAB ORDER: the scroll area
 * makes itself a tab stop whenever the level overflows, which would strand the footer.
 */
const CascaderPanel = React.forwardRef<HTMLDivElement, CascaderPanelProps>(function CascaderPanel({ className, render, ...props }, ref): React.ReactElement {
	const { mode } = useCascaderActions();

	const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>): void => {
		if (event.key !== "Tab" || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
			return;
		}
		const panel = event.currentTarget;
		const { target } = event;
		if (!(target instanceof Element) || !panel.contains(target)) {
			return;
		}
		const next = getCascaderTabTarget(panel, target, event.shiftKey);
		// Off either end: left to the browser, since focus is never trapped.
		if (next === null) {
			return;
		}
		event.preventDefault();
		next.focus();
	}, []);

	// In `defaultProps`: `mergeProps` chains right to left, so a consumer's handler runs FIRST and can drop this one.
	const defaultProps = { "data-slot": "cascader-panel", "data-mode": mode, onKeyDown: handleKeyDown, className: cn("flex max-h-full min-h-0 w-full flex-col", className) };

	return useRender({ defaultTagName: "div", render, ref, props: mergeProps<"div">(defaultProps, props) });
});

/* -------------------------------------------------------------------------- */
/*                                    List                                    */
/* -------------------------------------------------------------------------- */

export interface CascaderListProps extends Omit<ComboboxPrimitive.List.Props, "style"> {
	/** Applied to the OUTER shell, which owns the height. */
	readonly style?: React.CSSProperties | undefined;
	/** Caps this level's height; the panel still shrinks to fit. Default 24rem. A number is pixels. */
	readonly maxHeight?: number | string | undefined;
}

type CascaderListShellStyle = React.CSSProperties & Partial<Readonly<Record<"--cascader-max-height", string>>>;

/**
 * Scroll container for one level: viewport-bounded popup scroll, the height
 * `min()` of `--available-height` and `maxHeight`, so neither can be ignored.
 */
const CascaderList = React.forwardRef<HTMLDivElement, CascaderListProps>(function CascaderList(
	{ className, style, maxHeight: maxHeightProp, ...props },
	ref,
): React.JSX.Element {
	const { maxHeight, mode, labels, baseId, virtualized, searchScope } = useCascaderActions();
	const { currentParent, deepResults } = useCascaderState();
	const resolved = maxHeightProp ?? maxHeight;
	// Global hits come from the whole tree, so the parent would understate them.
	const listName = searchScope === "global" && deepResults !== null ? labels.rootLevel : (currentParent?.label ?? labels.rootLevel);

	const shellStyle = React.useMemo(
		(): CascaderListShellStyle | undefined => (resolved === undefined ? style : { ...style, "--cascader-max-height": toCascaderCssLength(resolved) }),
		[resolved, style],
	);

	return (
		<div data-slot="cascader-list-shell" style={shellStyle} className={cn("relative flex max-h-full min-h-0", CASCADER_LIST_PAD_CLASS)}>
			<div data-slot="cascader-list-bounds" className={cn("flex w-full min-w-0 flex-col overscroll-contain", CASCADER_LIST_HEIGHT_CLASS)}>
				<ScrollArea className={CASCADER_SCROLL_CLASS}>
					<ComboboxPrimitive.List
						ref={ref}
						data-slot="cascader-list"
						// Base UI names the list nothing. The level's parent is the name; the root borrows one.
						aria-label={listName}
						// Replaces Base UI's floating id, so `aria-controls` gets a predictable target.
						id={`${baseId}-column-0`}
						role={mode === "tree" ? "tree" : "listbox"}
						data-virtualized={virtualized ? "" : undefined}
						className={cn(CASCADER_ROWS_CLASS, virtualized ? "relative" : undefined, className)}
						{...props}
					/>
				</ScrollArea>
			</div>
		</div>
	);
});

/* -------------------------------------------------------------------------- */
/*                              Empty / Loading                               */
/* -------------------------------------------------------------------------- */

export type CascaderEmptyProps = ComboboxPrimitive.Empty.Props;

function resolveEmptyState(state: CascaderLoadState | null): "error" | "loading" | "empty" {
	if (state?.error === true) {
		return "error";
	}
	return state?.loading === true ? "loading" : "empty";
}

/**
 * The empty, loading and error surface, in ONE element that never unmounts:
 * `Combobox.Empty` renders whenever nothing is listed, as true of a fetching
 * level as of an empty one, so the CHILDREN swap.
 */
const CascaderEmpty = React.forwardRef<HTMLDivElement, CascaderEmptyProps>(function CascaderEmpty({ className, children, ...props }, ref): React.JSX.Element {
	const { labels, retryLevel, retrySearch } = useCascaderActions();
	const { query, path, searchState } = useCascaderState();
	// The level whose emptiness is on screen; tree always shows the root.
	const levelKey = path.at(-1) ?? CASCADER_ROOT_KEY;
	const loadState = useCascaderLoadState(levelKey);
	const searching = query.trim() !== "";
	const state = searching ? (searchState ?? loadState) : loadState;
	const emptyState = resolveEmptyState(state);

	const handleRetry = React.useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			focusCascaderHome(event.currentTarget);
			// With a query set the error shown is the SEARCH's, so that is what to ask again.
			if (searching && searchState?.error === true) {
				retrySearch();
			} else {
				retryLevel(levelKey);
			}
		},
		[searching, searchState, retrySearch, retryLevel, levelKey],
	);

	let body: React.ReactNode = children ?? labels.empty;
	if (emptyState === "error") {
		body = (
			<span data-slot="cascader-error" className="flex flex-col items-center gap-1.5">
				<span>{labels.error}</span>
				{/* A real button: this lives OUTSIDE the listbox. */}
				<button
					type="button"
					data-slot="cascader-retry"
					onClick={handleRetry}
					className="rounded-md px-2 py-0.5 font-medium text-foreground outline-hidden transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50">
					{labels.retry}
				</button>
			</span>
		);
	} else if (emptyState === "loading") {
		body = (
			<span data-slot="cascader-loading" className="flex w-full items-center justify-center">
				{labels.loading}
			</span>
		);
	}

	return (
		<ComboboxPrimitive.Empty
			ref={ref}
			data-slot="cascader-empty"
			data-state={emptyState}
			className={cn("hidden w-full justify-center py-2 text-center text-sm text-muted-foreground group-data-empty/combobox-content:flex", className)}
			// Explicit `undefined` DELETES Base UI's own live region: `CascaderStatus` is the single one.
			role={undefined}
			aria-live={undefined}
			aria-atomic={undefined}
			{...props}>
			{body}
		</ComboboxPrimitive.Empty>
	);
});

export type CascaderStatusProps = ComboboxPrimitive.Status.Props;

/** Polite live region for the current level and result count, which drill-down otherwise hides in a visual breadcrumb. */
const CascaderStatus = React.forwardRef<HTMLDivElement, CascaderStatusProps>(function CascaderStatus({ className, children, ...props }, ref): React.JSX.Element {
	const { announcement } = useCascaderState();
	return (
		<ComboboxPrimitive.Status ref={ref} data-slot="cascader-status" className={cn("sr-only", className)} {...props}>
			{children ?? announcement}
		</ComboboxPrimitive.Status>
	);
});

export { Cascader, CascaderChip, CascaderChips, CascaderContent, CascaderEmpty, CascaderList, CascaderPanel, CascaderStatus, CascaderTrigger };

/** Re-exported from `cascader-context.tsx`, so `cascader` stays the one import path. */
export { createCascaderHighlightStore, useCascaderActions, useCascaderHighlight, useCascaderRender, useCascaderState };

export type {
	CascaderActionsContextValue,
	CascaderColumn,
	CascaderHighlight,
	CascaderHighlightStore,
	CascaderItemState,
	CascaderRenderContextValue,
	CascaderStateContextValue,
};
