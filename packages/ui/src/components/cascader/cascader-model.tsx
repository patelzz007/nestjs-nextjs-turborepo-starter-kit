"use client";

// The cascader's model (enhancement 8.1: split from cascader.tsx): constants, controllable state, selection helpers, its props types and the
// frame store.

import { isArrayValue } from "@workspace/shared";
import type { CascaderGetChildren, CascaderLoadErrorHandler, CascaderOnSearch, CascaderResolveValue } from "@workspace/ui/components/cascader/cascader-async";
import { useCascaderActions, useCascaderState } from "@workspace/ui/components/cascader/cascader-context";
import type { CascaderActionsContextValue, CascaderExpandTrigger, CascaderItemState, CascaderStateContextValue } from "@workspace/ui/components/cascader/cascader-context";
import { buildCascaderIndex, getCascaderPath } from "@workspace/ui/components/cascader/cascader-lib";
import type {
	CascaderActionItem,
	CascaderChangeDetails,
	CascaderIndex,
	CascaderLabels,
	CascaderMode,
	CascaderNode,
	CascaderNodeBase,
	CascaderSearchScope,
	CascaderSelectable,
	CascaderSize,
} from "@workspace/ui/components/cascader/cascader-types";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import * as React from "react";

/** Stable empty lists, so a cascader with no footer or no default path republishes nothing. */
export const NO_ACTIONS: readonly CascaderActionItem[] = [];
export const NO_VALUES: readonly string[] = [];
export const NO_NODES: CascaderNodeBase[] = [];

/** Word joiner. A polite region reads only MUTATIONS, so it alternates on the end of the text. */
export const ANNOUNCE_MARKER = "⁠";

/** Delay before a query's result count reaches the live region: re-announcing per keystroke plays back stale counts. */
export const CASCADER_ANNOUNCE_DEBOUNCE_MS = 150;

/** Row count at which windowing turns itself on. */
export const CASCADER_VIRTUALIZE_THRESHOLD = 100;

/** Joins level keys into one string, so a loading flip that leaves `hasMore` alone keeps the merged index. */
export const PAGING_KEY_SEPARATOR = "\u001f";

/** The `onSearch` scope of a global search: no path, so the whole tree. */
export const GLOBAL_SEARCH_PATH: readonly string[] = [];

/* -------------------------------------------------------------------------- */
/*                                   State                                    */
/* -------------------------------------------------------------------------- */

export interface ControllableLatest<V, TMeta> {
	readonly value: V;
	readonly isControlled: boolean;
	readonly onChange: ((value: V, meta: TMeta) => void) | undefined;
}

/**
 * Controlled when the prop is defined, uncontrolled (from `defaultValue`)
 * otherwise — decided per prop, never a hybrid. The setter carries a `meta`
 * the change callback receives (a path change's reason, an open change's).
 */
export function useControllable<V, TMeta>(
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

export function toSingleSelection(value: string | undefined): readonly string[] | undefined {
	if (value === undefined) {
		return undefined;
	}
	return value === "" ? NO_VALUES : [value];
}

export function withoutBlank(values: readonly string[] | undefined): readonly string[] | undefined {
	if (values === undefined) {
		return undefined;
	}
	return values.some((value: string): boolean => value === "") ? values.filter((value: string): boolean => value !== "") : values;
}

export function sameValues(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value: string, position: number): boolean => value === right.at(position));
}

/** A payload-free node, re-typed for the caller's payload: every field but `children` and `data`, which it never had. */
export function retypeCascaderNode<TData>(node: CascaderNodeBase): CascaderNode<TData> {
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

export function isNodeList(value: CascaderNodeBase | CascaderNodeBase[] | null): value is CascaderNodeBase[] {
	return isArrayValue(value);
}

export function itemToStringValue(item: CascaderNodeBase): string {
	return item.value;
}

export function itemToStringLabel(item: CascaderNodeBase): string {
	return item.label;
}

export function isItemEqualToValue(item: CascaderNodeBase, value: CascaderNodeBase): boolean {
	return item.value === value.value;
}

/* -------------------------------------------------------------------------- */
/*                                  Context                                   */
/* -------------------------------------------------------------------------- */

/** The pre-split shape, merged, so `useCascader()` returns what it always did. */
export interface CascaderContextValue extends CascaderActionsContextValue, CascaderStateContextValue {}

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
export type CascaderPendingNavigation =
	| { readonly value: string; readonly kind: "push" | "expand" }
	| { readonly value: string; readonly kind: "at"; readonly depth: number }
	| { readonly value: string; readonly kind: "trail"; readonly trail: readonly string[] };

export interface CascaderAnnounceSignal {
	readonly seq: number;
	/** The tree branch a toggle named. */
	readonly toggled: string | null;
	/** A one-off verbatim message: a `max` refusal, a cascade fan-out. */
	readonly notice: string | null;
}

export interface CascaderAnnouncement {
	readonly text: string;
	/** Only a stream of keystrokes (the result count) is coalesced; every event-shaped announcement is immediate. */
	readonly defer: boolean;
}

/** One "frame" of the level-swap reset, released from a layout effect through an external store. */
export interface CascaderFrameStore {
	readonly subscribe: (listener: () => void) => () => void;
	readonly getSnapshot: () => number;
	readonly release: (seq: number) => void;
}

export function createCascaderFrameStore(): CascaderFrameStore {
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

export interface CascaderLatest<TData> {
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
