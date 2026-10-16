"use client";

import type {
	CascaderActionItem,
	CascaderChangeReason,
	CascaderFlatNode,
	CascaderIndex,
	CascaderLabels,
	CascaderLoadState,
	CascaderMode,
	CascaderNodeBase,
	CascaderSearchScope,
	CascaderSize,
} from "@workspace/ui/components/cascader/cascader-types";
import * as React from "react";

/**
 * Four contexts, not one: actions (config and callbacks, near-stable), state
 * (every keystroke), render (`renderItem` identity) and highlight (every arrow
 * key and pointer move). One combined context re-rendered every row on every
 * keystroke, which is what made `React.memo` on the row worth nothing.
 *
 * Every value here is payload-free (`CascaderNodeBase`): a context cannot carry
 * the caller's generic. The root keeps the typed nodes and re-resolves them by
 * value wherever the caller's own types come back out.
 */

/* -------------------------------------------------------------------------- */
/*                                Shared types                                */
/* -------------------------------------------------------------------------- */

export interface CascaderColumn {
	readonly parent: CascaderNodeBase | null;
	readonly items: readonly CascaderNodeBase[];
	readonly depth: number;
	/** The node in this column that is drilled into, if any. */
	readonly activeValue: string | null;
	/** Whether this is the deepest column, the one Base UI owns. */
	readonly active: boolean;
}

export interface CascaderItemState<TNode extends CascaderNodeBase = CascaderNodeBase> {
	readonly branch: boolean;
	readonly selected: boolean;
	/** The node's own flag or a disabled ancestor's, as `isCascaderDisabled`. */
	readonly disabled: boolean;
	readonly depth: number;
	readonly count: number;
	/** Ancestor chain, root first. Populated for deep and global search rows. */
	readonly path: readonly TNode[];
}

/* -------------------------------------------------------------------------- */
/*                                    State                                   */
/* -------------------------------------------------------------------------- */

/**
 * Everything derived from the query, the path and the selection. One keystroke
 * rebuilds most of it, so never subscribe to it from a row.
 */
export interface CascaderStateContextValue {
	/** Same `useMemo` identity as the actions context's `index`. */
	readonly index: CascaderIndex;
	readonly path: readonly string[];
	readonly expanded: ReadonlySet<string>;
	readonly query: string;
	readonly currentParent: CascaderNodeBase | null;
	/** Rows for the current level, already filtered. */
	readonly levelItems: readonly CascaderNodeBase[];
	readonly deepResults: readonly CascaderNodeBase[] | null;
	/** What `Combobox.Root` is currently rendering, in render order. */
	readonly renderedItems: readonly CascaderNodeBase[];
	readonly columns: readonly CascaderColumn[];
	readonly treeRows: readonly CascaderFlatNode[];
	readonly selectedValues: readonly string[];
	/** Selected nodes below each value, at any depth. Absent means zero. */
	readonly selectedDescendants: ReadonlyMap<string, number>;
	/**
	 * Per level, keyed by parent value or `CASCADER_ROOT_KEY`. MEMBERSHIP is the
	 * discriminator: no entry means never fetched, an entry with no `loading`, no
	 * `error` and no children means fetched and genuinely empty.
	 */
	readonly loadStates: ReadonlyMap<string, CascaderLoadState>;
	/** Async search, `null` when idle. Separate: a search belongs to no level. */
	readonly searchState: CascaderLoadState | null;
	readonly announcement: string;
}

const CascaderStateContext = React.createContext<CascaderStateContextValue | null>(null);

export function useCascaderState(): CascaderStateContextValue {
	const context = React.useContext(CascaderStateContext);
	if (context === null) {
		throw new Error("useCascaderState must be used within a Cascader");
	}
	return context;
}

/* -------------------------------------------------------------------------- */
/*                                   Actions                                  */
/* -------------------------------------------------------------------------- */

/** How a branch opens from the pointer in columns mode's active column. */
export type CascaderExpandTrigger = "click" | "hover";

/**
 * Config and callbacks, slow enough that a memoised row can subscribe: the
 * mutators are stable callbacks over a latest-props ref. The predicates are
 * the exception, read DURING RENDER, so each is memoised on its own input.
 */
export interface CascaderActionsContextValue {
	readonly index: CascaderIndex;
	readonly mode: CascaderMode;
	readonly size: CascaderSize;
	readonly multiple: boolean;
	/** Multi-select only: a commit propagates over the LOADED subtree. */
	readonly cascade: boolean;
	/** Whether a BRANCH is committable. Per-LIST: the check gutter is a COLUMN. */
	readonly branchesSelectable: boolean;
	/** Draws the SINGLE-SELECT check and its gutter. Ignored in multi-select. */
	readonly indicator: boolean;
	readonly expandTrigger: CascaderExpandTrigger;
	readonly actions: readonly CascaderActionItem[];
	readonly searchScope: CascaderSearchScope;
	readonly maxHeight: number | string | undefined;
	readonly inline: boolean;
	readonly invalid: boolean;
	readonly disabled: boolean;
	/** The root's `loading` flag: the trigger shows the loading state while the caller resolves something. */
	readonly loading: boolean;
	/** Id prefix; columns are `${baseId}-column-${depth}`. */
	readonly baseId: string;
	readonly labels: CascaderLabels;

	/** Whether rows are WINDOWED. Also handed to `Combobox.Root`, which is what makes an explicit row `index` legal. Latched per level. */
	readonly virtualized: boolean;
	/** Mounts a windowing renderer, returns its unregister. LAYOUT effect only. */
	readonly registerVirtualRenderer: () => () => void;
	/** The root's `virtualize` prop. `undefined` means "decide by count". */
	readonly virtualize: boolean | undefined;
	readonly virtualizeThreshold: number;
	readonly estimateRowSize: number;
	readonly overscan: number;

	/** Tells "this level is empty" from "not fetched yet" before a load state. */
	readonly hasLoader: boolean;
	/** Next page of a level. Latched: a page with nothing new is not re-asked. */
	readonly loadMore: (parentKey: string) => void;
	readonly retryLevel: (parentKey: string) => void;
	/** Re-runs a failed server search (`onSearch`) for the current query. */
	readonly retrySearch: () => void;
	/** Evicts one level's async cache, `null` for the root, so membership reads never-loaded. */
	readonly invalidateLevel: (value: string | null) => void;

	/** Index as of the last commit. Use in the stable callbacks, not `index`. */
	readonly getIndex: () => CascaderIndex;
	readonly getState: () => CascaderStateContextValue;
	/** Highlighted row or null. A getter: the highlight moves per arrow key. */
	readonly getHighlighted: () => CascaderNodeBase | null;

	readonly setPath: (next: readonly string[]) => void;
	readonly pushLevel: (value: string) => void;
	readonly popLevel: () => void;
	readonly goToDepth: (depth: number) => void;
	readonly toggleExpanded: (value: string) => void;
	/** Registers a footer submenu as open or closed, so one Escape closes the flyout, not the cascader too. */
	readonly setFlyoutOpen: (key: string, open: boolean) => void;
	readonly hasOpenFlyout: () => boolean;
	readonly setQuery: (next: string) => void;
	/** Replaces the selection. `onValueChange` diffs it against the current one for its node and reason. */
	readonly setSelection: (values: readonly string[], reason?: CascaderChangeReason) => void;
	/** Commits a node, for rows outside the listbox such as ancestor columns. */
	readonly commit: (node: CascaderNodeBase) => void;
	readonly navigate: (node: CascaderNodeBase) => void;
	/** Into `node` as a child of `depth`, replacing anything deeper. */
	readonly navigateAt: (node: CascaderNodeBase, depth: number) => void;
	/** Never undefined: falls back to a remembered label, then a synthetic node. */
	readonly resolveNode: (value: string) => CascaderNodeBase;
	readonly isBranch: (node: CascaderNodeBase) => boolean;
	readonly isSelectable: (node: CascaderNodeBase) => boolean;
	/** The node or an ancestor is `disabled`. */
	readonly isDisabled: (node: CascaderNodeBase) => boolean;
	readonly isSelected: (node: CascaderNodeBase) => boolean;
	/** Always `false` without `cascade`: partial selection needs propagation. */
	readonly isIndeterminate: (node: CascaderNodeBase) => boolean;
	/** O(1) read of `selectedDescendants`; a memoised row may not subscribe. */
	readonly selectedDescendantCount: (node: CascaderNodeBase) => number;
}

const CascaderActionsContext = React.createContext<CascaderActionsContextValue | null>(null);

export function useCascaderActions(): CascaderActionsContextValue {
	const context = React.useContext(CascaderActionsContext);
	if (context === null) {
		throw new Error("useCascaderActions must be used within a Cascader");
	}
	return context;
}

/* -------------------------------------------------------------------------- */
/*                                Render props                                */
/* -------------------------------------------------------------------------- */

/** Replaces a row, or its label block, given the node and its state. */
export type CascaderRenderNode = (node: CascaderNodeBase, state: CascaderItemState) => React.ReactNode;

/**
 * Their own context, republished whenever the props change. They cannot ride on
 * the actions context: an inline closure read off a memoised object is whichever
 * closure that object captured, so the row would call a stale prop.
 */
export interface CascaderRenderContextValue {
	readonly renderItem: CascaderRenderNode | undefined;
	readonly renderLabel: CascaderRenderNode | undefined;
}

const NO_RENDER_PROPS: CascaderRenderContextValue = { renderItem: undefined, renderLabel: undefined };

const CascaderRenderContext = React.createContext<CascaderRenderContextValue>(NO_RENDER_PROPS);

export function useCascaderRender(): CascaderRenderContextValue {
	return React.useContext(CascaderRenderContext);
}

/* -------------------------------------------------------------------------- */
/*                               Highlight store                              */
/* -------------------------------------------------------------------------- */

export interface CascaderHighlight {
	readonly index: number;
	readonly value: string | null;
}

/**
 * An external store, deliberately NOT React state: `onItemHighlighted` fires on
 * every arrow key AND every pointer move over the list, so `setState` would
 * re-render the whole root at mousemove rate. A store re-renders subscribers
 * only, which inside the primitive is the virtualizer.
 */
export interface CascaderHighlightStore {
	readonly subscribe: (onStoreChange: () => void) => () => void;
	readonly getSnapshot: () => CascaderHighlight;
	readonly set: (next: CascaderHighlight) => void;
}

/** No row highlighted. */
export const CASCADER_NO_HIGHLIGHT: CascaderHighlight = { index: -1, value: null };

export function createCascaderHighlightStore(): CascaderHighlightStore {
	let snapshot: CascaderHighlight = CASCADER_NO_HIGHLIGHT;
	const listeners = new Set<() => void>();

	return {
		subscribe: (onStoreChange: () => void): (() => void) => {
			listeners.add(onStoreChange);
			return (): void => {
				listeners.delete(onStoreChange);
			};
		},
		// The SAME object until something changes; `useSyncExternalStore` needs it.
		getSnapshot: (): CascaderHighlight => snapshot,
		set: (next: CascaderHighlight): void => {
			if (next.index === snapshot.index && next.value === snapshot.value) {
				return;
			}
			snapshot = next;
			for (const listener of listeners) {
				listener();
			}
		},
	};
}

/** Shared and permanently empty, so the hook degrades outside a `Cascader`. */
const FALLBACK_HIGHLIGHT_STORE = createCascaderHighlightStore();

const CascaderHighlightContext = React.createContext<CascaderHighlightStore>(FALLBACK_HIGHLIGHT_STORE);

/** Subscribes to the highlight. Re-renders ONLY the calling component. */
export function useCascaderHighlight(): CascaderHighlight {
	const store = React.useContext(CascaderHighlightContext);
	return React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

export { CascaderActionsContext, CascaderHighlightContext, CascaderRenderContext, CascaderStateContext };
