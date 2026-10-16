"use client";

import * as React from "react";

import type { FilterDraftAction } from "./filters-draft";
import type { FilterPathCollapse } from "./filters-lib";
import type { FilterRuleUpdates } from "./filters-query";
import type {
	FilterCombinator,
	FilterDraft,
	FilterDraftStep,
	FilterEditor,
	FilterEditorRegistry,
	FilterEmptyStateContext,
	FilterField,
	FilterIndex,
	FilterLabels,
	FilterOperator,
	FilterOperatorCatalog,
	FilterOption,
	FilterQuery,
	FilterRule,
	FilterValueDisplayContext,
} from "./filters-types";

/**
 * Four publishing channels, not one, so a chip never re-renders at the rate of
 * the fastest: `actions` republishes on a schema, labels or config change,
 * `state` on every query edit, `render` on a render-prop identity change, and
 * `focus` (an external store) on every arrow key.
 */

/* -------------------------------------------------------------------------- */
/*                                   Actions                                  */
/* -------------------------------------------------------------------------- */

/** The density of the whole bar. Two rungs. */
export type FilterSize = "sm" | "default";

/** Which chrome is drawing. */
export type FilterVariant = "basic" | "advanced";

/**
 * Stable for the life of the component, bar a config change. Every mutator
 * reads a latest-props ref rather than closing over state, so a keystroke
 * rebuilds no handler. Every mutator is also the MUTATION BOUNDARY: `disabled`
 * and `readOnly` are enforced there, not at the call sites that draw buttons.
 */
export interface FilterActionsContextValue {
	/** Normalized schema. */
	readonly index: FilterIndex;
	readonly labels: FilterLabels;
	readonly operatorCatalog: FilterOperatorCatalog;
	readonly editors: FilterEditorRegistry;
	readonly size: FilterSize;
	/** The bar is off: nothing operable, and the controls leave the tab order. */
	readonly disabled: boolean;
	/** Readable and navigable, but not changeable. See `isFilterLocked`. */
	readonly readOnly: boolean;
	readonly variant: FilterVariant;
	/** Consumer classes for the menus and the field picker, merged AFTER the defaults. */
	readonly menuClassName: string | undefined;
	readonly fieldPickerClassName: string | undefined;
	/** Turns on the chip menu's "Convert to advanced" row: present means offered. */
	readonly convertToAdvanced: (() => void) | undefined;
	/** Path shortening, published so BOTH chromes render the same path. */
	readonly pathCollapse: FilterPathCollapse;
	readonly maxPathSegments: number;

	/** Operators for a field, memoized on the catalog and the schema. */
	readonly resolveOperators: (field: FilterField) => readonly FilterOperator[];
	readonly resolveEditor: (field: FilterField, operator: FilterOperator | undefined) => FilterEditor | undefined;
	/** Value-to-label store shared by every `useFilterOptions` under the root. */
	readonly resolution: FilterResolutionStore;

	/** Appends a rule. Defaults to the ROOT group. */
	readonly addRule: (rule: FilterRule, parentId?: string) => void;
	/** Appends an empty group and returns its id, or `""` when refused. */
	readonly addGroup: (parentId?: string, combinator?: FilterCombinator) => string;
	readonly updateRule: (id: string, updates: FilterRuleUpdates) => void;
	/** Removes a rule OR a group, and prunes the groups that empties. */
	readonly removeNode: (id: string) => void;
	readonly duplicateNode: (id: string) => void;
	readonly negateRule: (id: string) => void;
	/** Reorders within the node's own parent. Out of range moves are no-ops. */
	readonly moveNode: (id: string, delta: number) => void;
	/** Moves a node into another group, at an index. */
	readonly moveNodeTo: (id: string, parentId: string, index: number) => void;
	/** Copies a node into another group, at an index. The Alt-drag half. */
	readonly copyNodeTo: (id: string, parentId: string, index: number) => void;
	/** Nests one node in a new group. */
	readonly wrapNodeInGroup: (id: string, combinator?: FilterCombinator) => void;
	/** Dissolves a group into its parent. */
	readonly unwrapGroup: (groupId: string) => void;
	readonly setCombinator: (groupId: string, combinator: FilterCombinator) => void;
	readonly toggleCombinator: (groupId: string) => void;
	readonly clearQuery: () => void;

	readonly openCreate: () => void;
	readonly openAmend: (id: string, step: FilterDraftStep) => void;
	readonly closeDraft: () => void;
	readonly dispatchDraft: (action: FilterDraftAction) => void;

	/** Writes the bar's live region, for a change no visible surface reports. */
	readonly announce: (message: string) => void;

	/** Getters for event handlers, so a handler never closes over stale state. */
	readonly getQuery: () => FilterQuery;
	readonly getDraft: () => FilterDraft | null;
	/** Fresh id from the SSR-safe factory. */
	readonly nextId: () => string;
}

/* -------------------------------------------------------------------------- */
/*                             The mutation lock                              */
/* -------------------------------------------------------------------------- */

export interface FilterLockState {
	readonly disabled: boolean;
	readonly readOnly: boolean;
}

/**
 * `disabled` and `readOnly` are NOT two words for one state. `disabled` is the
 * native attribute: not operable, out of the tab order. `readOnly` blocks
 * MUTATION and preserves NAVIGATION, so a keyboard or screen reader user can
 * walk the chips and find out what the view is filtered by.
 */
export function isFilterLocked(state: FilterLockState): boolean {
	return state.disabled || state.readOnly;
}

/** What a MUTATING control wears while the bar is read only. */
/** `data-readonly` is a presence hook; `aria-disabled` keeps the control focusable. */
export type FilterReadOnlyProps = Readonly<Record<"aria-disabled" | "data-readonly", true | undefined>>;

const NOT_READ_ONLY: FilterReadOnlyProps = { "aria-disabled": undefined, "data-readonly": undefined };
const READ_ONLY: FilterReadOnlyProps = { "aria-disabled": true, "data-readonly": true };

/**
 * The props a mutating control spreads: `aria-disabled` plus a `data-readonly`
 * presence hook while read only, nothing when the bar is disabled (the native
 * attribute already says it) or editable.
 */
export function filterReadOnlyProps(state: FilterLockState): FilterReadOnlyProps {
	return state.disabled || !state.readOnly ? NOT_READ_ONLY : READ_ONLY;
}

/* -------------------------------------------------------------------------- */
/*                               The size ladder                              */
/* -------------------------------------------------------------------------- */

/** The two kit button sizes one filters size resolves to. */
export interface FilterControlSizes {
	/** Labelled buttons: the row cells, both triggers, the panel footer. */
	readonly button: "xs" | "sm";
	/** Icon-only buttons, and also the CHIP's height (the kebab sets the pill's). */
	readonly icon: "icon-xs" | "icon-sm";
}

/** ONE ladder, keyed off `size`, for every control the chrome renders. */
const FILTER_CONTROL_SIZES: Readonly<Record<FilterSize, FilterControlSizes>> = {
	sm: { button: "xs", icon: "icon-xs" },
	default: { button: "sm", icon: "icon-sm" },
};

/** The pair for a bar's size, so a consumer-composed chrome uses the same ladder. */
export function filterControlSizes(state: { readonly size: FilterSize }): FilterControlSizes {
	return FILTER_CONTROL_SIZES[state.size];
}

const FilterActionsContext = React.createContext<FilterActionsContextValue | null>(null);

export function useFilterActions(): FilterActionsContextValue {
	const context = React.useContext(FilterActionsContext);
	if (context === null) {
		throw new Error("useFilterActions must be used inside <Filters>");
	}
	return context;
}

/** The actions, or null outside a `Filters` root, for hooks that degrade gracefully. */
export function useOptionalFilterActions(): FilterActionsContextValue | null {
	return React.useContext(FilterActionsContext);
}

/* -------------------------------------------------------------------------- */
/*                                    State                                   */
/* -------------------------------------------------------------------------- */

/** Volatile by construction. Subscribe from the bar and the panel, never from a chip. */
export interface FilterStateContextValue {
	readonly query: FilterQuery;
	readonly draft: FilterDraft | null;
	readonly ruleCount: number;
	/** Live region text. Empty except immediately after an announced change. */
	readonly announcement: string;
	/** How many announcements have been made, so a REPEATED one is still heard. */
	readonly announcementSeq: number;
}

const FilterStateContext = React.createContext<FilterStateContextValue | null>(null);

export function useFilterState(): FilterStateContextValue {
	const context = React.useContext(FilterStateContext);
	if (context === null) {
		throw new Error("useFilterState must be used inside <Filters>");
	}
	return context;
}

/* -------------------------------------------------------------------------- */
/*                                   Render                                   */
/* -------------------------------------------------------------------------- */

/** Consumer render overrides, on their own channel. */
export interface FilterRenderContextValue {
	readonly renderValue?: ((context: FilterValueDisplayContext) => React.ReactNode) | undefined;
	readonly renderChip?: ((rule: FilterRule) => React.ReactNode) | undefined;
	readonly renderEmpty?: ((context: FilterEmptyStateContext) => React.ReactNode) | undefined;
}

const NO_RENDER_OVERRIDES: FilterRenderContextValue = {};

const FilterRenderContext = React.createContext<FilterRenderContextValue>(NO_RENDER_OVERRIDES);

export function useFilterRender(): FilterRenderContextValue {
	return React.useContext(FilterRenderContext);
}

/* -------------------------------------------------------------------------- */
/*                                 Focus store                                */
/* -------------------------------------------------------------------------- */

/** Which cell of a chip or builder row the focus store names. */
export type FilterFocusSegment = "combinator" | "field" | "operator" | "value" | "add" | "menu" | "ungroup" | "remove" | "drag";

/** Which chip currently owns the row's single tab stop. */
export interface FilterFocus {
	readonly id: string | null;
	/** Which cell inside that row, for restoring focus after an edit. */
	readonly segment: FilterFocusSegment | null;
	/** Open that segment's popover, not merely focus it. */
	readonly autoOpen: boolean;
}

/**
 * An external store, deliberately NOT React state: a roving tabindex
 * republishes on every arrow key, and `setState` would re-render the whole bar
 * to move one outline. The selector hooks below each narrow to one value.
 */
export interface FilterFocusStore {
	readonly subscribe: (onStoreChange: () => void) => () => void;
	readonly getSnapshot: () => FilterFocus;
	/** No-ops when nothing changed. */
	readonly set: (next: FilterFocus) => void;
}

export const NO_FILTER_FOCUS: FilterFocus = { id: null, segment: null, autoOpen: false };

export function createFilterFocusStore(): FilterFocusStore {
	let snapshot: FilterFocus = NO_FILTER_FOCUS;
	const listeners = new Set<() => void>();
	return {
		subscribe: (onStoreChange: () => void): (() => void) => {
			listeners.add(onStoreChange);
			return (): void => {
				listeners.delete(onStoreChange);
			};
		},
		// The SAME object until something changes, which `useSyncExternalStore` requires.
		getSnapshot: (): FilterFocus => snapshot,
		set: (next: FilterFocus): void => {
			if (next.id === snapshot.id && next.segment === snapshot.segment && next.autoOpen === snapshot.autoOpen) {
				return;
			}
			snapshot = next;
			for (const listener of listeners) {
				listener();
			}
		},
	};
}

/** A shared, permanently empty store, so the hooks degrade to "nothing focused" outside a `Filters`. */
const FALLBACK_FOCUS_STORE = createFilterFocusStore();

const FilterFocusContext = React.createContext<FilterFocusStore>(FALLBACK_FOCUS_STORE);

/* -------------------------------------------------------------------------- */
/*                                 Reordering                                 */
/* -------------------------------------------------------------------------- */

/** Whether rows may be reordered at all, published once for the subtree. */
const FilterReorderContext = React.createContext(false);

export const FilterReorderProvider = FilterReorderContext.Provider;

export function useFilterReorderable(): boolean {
	return React.useContext(FilterReorderContext);
}

/* -------------------------------------------------------------------------- */
/*                                   Touched                                  */
/* -------------------------------------------------------------------------- */

/**
 * Which rules the user has edited the VALUE of, which decides WHEN an error may
 * appear: "Add filter" mints a row with no value, so flagging every invalid row
 * turns the builder red before the user did anything wrong.
 */
export interface FilterRowStateStore {
	readonly subscribe: (listener: () => void) => () => void;
	/** Bumped on every write. What a memo depends on, since the sets are mutable. */
	readonly version: () => number;
	/** Whether this rule has had a value committed to it by the user. */
	readonly has: (id: string) => boolean;
	readonly mark: (id: string) => void;
	/** Starts this rule over (its attribute changed). */
	readonly unmark: (id: string) => void;
	/** Whether this rule is still being CREATED: minted by Add filter, no attribute chosen yet. */
	readonly isPending: (id: string) => boolean;
	readonly markPending: (id: string) => void;
	/** The attribute was chosen. The rest of the row appears. */
	readonly resolvePending: (id: string) => void;
	/** Forgets everything. */
	readonly reset: () => void;
	/** The touched ids as an immutable snapshot that changes identity on every write. */
	readonly touchedSnapshot: () => ReadonlySet<string>;
}

export function createFilterRowStateStore(): FilterRowStateStore {
	const touched = new Set<string>();
	const pending = new Set<string>();
	const listeners = new Set<() => void>();
	let version = 0;
	let touchedCopy: ReadonlySet<string> = new Set<string>();
	const notify = (): void => {
		version += 1;
		touchedCopy = new Set(touched);
		for (const listener of listeners) {
			listener();
		}
	};
	return {
		touchedSnapshot: (): ReadonlySet<string> => touchedCopy,
		subscribe: (listener: () => void): (() => void) => {
			listeners.add(listener);
			return (): void => {
				listeners.delete(listener);
			};
		},
		version: (): number => version,
		has: (id: string): boolean => touched.has(id),
		mark: (id: string): void => {
			if (touched.has(id)) {
				return;
			}
			touched.add(id);
			notify();
		},
		unmark: (id: string): void => {
			if (touched.delete(id)) {
				notify();
			}
		},
		isPending: (id: string): boolean => pending.has(id),
		markPending: (id: string): void => {
			if (pending.has(id)) {
				return;
			}
			pending.add(id);
			notify();
		},
		resolvePending: (id: string): void => {
			if (pending.delete(id)) {
				notify();
			}
		},
		reset: (): void => {
			if (touched.size === 0 && pending.size === 0) {
				return;
			}
			touched.clear();
			pending.clear();
			notify();
		},
	};
}

const FALLBACK_ROW_STATE_STORE = createFilterRowStateStore();

const FilterRowStateContext = React.createContext<FilterRowStateStore>(FALLBACK_ROW_STATE_STORE);

export const FilterRowStateProvider = FilterRowStateContext.Provider;

/** The store itself, for handlers that write without subscribing. */
export function useFilterRowStateStore(): FilterRowStateStore {
	return React.useContext(FilterRowStateContext);
}

function returnFalse(): boolean {
	return false;
}

function returnTrue(): boolean {
	return true;
}

function returnNull(): null {
	return null;
}

/** Whether THIS rule is still waiting for its attribute. */
export function useFilterRowPending(id: string): boolean {
	const store = React.useContext(FilterRowStateContext);
	const getSnapshot = React.useCallback((): boolean => store.isPending(id), [store, id]);
	return React.useSyncExternalStore(store.subscribe, getSnapshot, returnFalse);
}

/** Whether THIS rule may show an error yet. */
export function useFilterTouched(id: string): boolean {
	const store = React.useContext(FilterRowStateContext);
	const getSnapshot = React.useCallback((): boolean => store.has(id), [store, id]);
	return React.useSyncExternalStore(store.subscribe, getSnapshot, returnFalse);
}

/** Every rule id the user has committed a value to, as a snapshot. */
export function useFilterTouchedIds(): ReadonlySet<string> {
	const store = React.useContext(FilterRowStateContext);
	return React.useSyncExternalStore(store.subscribe, store.touchedSnapshot, store.touchedSnapshot);
}

/** The whole focus snapshot: the caller re-renders on EVERY move. */
export function useFilterFocus(): FilterFocus {
	const store = React.useContext(FilterFocusContext);
	return React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

/** The store itself, for event handlers that write without subscribing. */
export function useFilterFocusStore(): FilterFocusStore {
	return React.useContext(FilterFocusContext);
}

/** The segment of THIS chip that should open itself, or null. */
export function useFilterChipAutoOpen(id: string): FilterFocusSegment | null {
	const store = React.useContext(FilterFocusContext);
	const getSnapshot = React.useCallback((): FilterFocusSegment | null => {
		const snapshot = store.getSnapshot();
		return snapshot.autoOpen && snapshot.id === id ? snapshot.segment : null;
	}, [store, id]);
	return React.useSyncExternalStore(store.subscribe, getSnapshot, returnNull);
}

/** Whether the row holds no focus, so the first chip keeps the tab stop. */
export function useFilterFocusEmpty(): boolean {
	const store = React.useContext(FilterFocusContext);
	const getSnapshot = React.useCallback((): boolean => store.getSnapshot().id === null, [store]);
	return React.useSyncExternalStore(store.subscribe, getSnapshot, returnTrue);
}

/** Whether THIS chip owns the row's tab stop. */
export function useFilterChipFocused(id: string): boolean {
	const store = React.useContext(FilterFocusContext);
	const getSnapshot = React.useCallback((): boolean => store.getSnapshot().id === id, [store, id]);
	return React.useSyncExternalStore(store.subscribe, getSnapshot, returnFalse);
}

/** Which segment of THIS rule owns the tab stop, or null when another rule does. */
export function useFilterSegmentFocus(id: string): FilterFocusSegment | null {
	const store = React.useContext(FilterFocusContext);
	const getSnapshot = React.useCallback((): FilterFocusSegment | null => {
		const snapshot = store.getSnapshot();
		return snapshot.id === id ? snapshot.segment : null;
	}, [store, id]);
	return React.useSyncExternalStore(store.subscribe, getSnapshot, returnNull);
}

/* -------------------------------------------------------------------------- */
/*                              Resolution store                              */
/* -------------------------------------------------------------------------- */

/**
 * The instance-wide value-to-label store. A chip's display and its editor are
 * two `useFilterOptions` instances, so a `loadOptions`-only field would render
 * its raw id the moment the menu closed. Every instance under one root writes
 * here; the version bumps only when a NEW label lands.
 */
export interface FilterResolutionStore {
	readonly subscribe: (onStoreChange: () => void) => () => void;
	readonly getVersion: () => number;
	/** The option behind a stored value, or undefined while unresolved. */
	readonly get: (fieldKey: string, value: string) => FilterOption | undefined;
	/** Records options under a field key. New values bump the version. */
	readonly set: (fieldKey: string, options: readonly FilterOption[]) => void;
	/** Marks values as resolving and returns the subset nobody has claimed yet. */
	readonly claim: (fieldKey: string, values: readonly string[]) => readonly string[];
	/** Releases claims after a FAILED resolve, so a later mount may retry. */
	readonly release: (fieldKey: string, values: readonly string[]) => void;
}

function bucketOf<T>(map: Map<string, T>, key: string, create: () => T): T {
	const existing = map.get(key);
	if (existing !== undefined) {
		return existing;
	}
	const created = create();
	map.set(key, created);
	return created;
}

export function createFilterResolutionStore(): FilterResolutionStore {
	const resolved = new Map<string, Map<string, FilterOption>>();
	const claimed = new Map<string, Set<string>>();
	const listeners = new Set<() => void>();
	let version = 0;
	const newOptionMap = (): Map<string, FilterOption> => new Map<string, FilterOption>();
	const newClaimSet = (): Set<string> => new Set<string>();
	return {
		subscribe: (onStoreChange: () => void): (() => void) => {
			listeners.add(onStoreChange);
			return (): void => {
				listeners.delete(onStoreChange);
			};
		},
		getVersion: (): number => version,
		get: (fieldKey: string, value: string): FilterOption | undefined => resolved.get(fieldKey)?.get(value),
		set: (fieldKey: string, options: readonly FilterOption[]): void => {
			const map = bucketOf(resolved, fieldKey, newOptionMap);
			let landed = false;
			for (const option of options) {
				if (!map.has(option.value)) {
					landed = true;
				}
				map.set(option.value, option);
			}
			if (!landed) {
				return;
			}
			version += 1;
			for (const listener of listeners) {
				listener();
			}
		},
		claim: (fieldKey: string, values: readonly string[]): readonly string[] => {
			const set = bucketOf(claimed, fieldKey, newClaimSet);
			const map = resolved.get(fieldKey);
			const fresh: string[] = [];
			for (const value of values) {
				if (set.has(value) || map?.has(value) === true) {
					continue;
				}
				set.add(value);
				fresh.push(value);
			}
			return fresh;
		},
		release: (fieldKey: string, values: readonly string[]): void => {
			const set = claimed.get(fieldKey);
			for (const value of values) {
				set?.delete(value);
			}
		},
	};
}

export { FilterActionsContext, FilterFocusContext, FilterRenderContext, FilterStateContext };
