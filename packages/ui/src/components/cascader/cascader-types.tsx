// Title: Cascader
// Description: Nested multi-level combobox with drill-down, columns and tree modes.

import type * as React from "react";

/**
 * Every field of a cascader node the primitive reads. The parts below the
 * root (`CascaderItem`, `CascaderValue`, …) only ever see this payload-free
 * view: a React context cannot carry the caller's generic, and the primitive
 * never inspects `data`. The root keeps the caller's typed nodes and hands
 * them back, typed, through `onValueChange`, `renderItem` and the loaders.
 */
export interface CascaderNodeBase {
	/** Stable id. Also the committed selection value. */
	readonly value: string;
	readonly label: string;
	readonly icon?: React.ReactNode;
	readonly description?: string | undefined;
	readonly children?: readonly CascaderNodeBase[] | undefined;
	/** Declares a branch before load; async nodes read as leaves without it. */
	readonly hasChildren?: boolean | undefined;
	/** Trailing count. Defaults to known children; set it for async nodes. */
	readonly count?: number | undefined;
	/** Listed, never selected or opened; on a branch, its whole subtree too. */
	readonly disabled?: boolean | undefined;
	readonly keywords?: readonly string[] | undefined;
	/**
	 * Only read on a node nested inside a `getChildren` result. For the level a
	 * node OWNS the authoritative signal is that level's `CascaderLoadResult`.
	 */
	readonly hasMore?: boolean | undefined;
}

/**
 * A node in the cascader tree. Two input shapes normalize to one internal
 * index: nested (nodes carry `children`), or flat adjacency plus the root's
 * `getParent`, which skips the re-nesting step for large datasets. `TData`
 * is the caller's own payload, preserved end to end.
 */
export interface CascaderNode<TData = undefined> extends CascaderNodeBase {
	readonly children?: readonly CascaderNode<TData>[] | undefined;
	readonly data?: TData | undefined;
}

/** A node whose `children` are its own type — what the tree walks need to keep the caller's type. */
export type CascaderTreeNode<TNode> = CascaderNodeBase & { readonly children?: readonly TNode[] | undefined };

/**
 * One footer ACTION. Deliberately not a `CascaderNode`, so a command can never
 * be passed where an option is expected and join the ring, filter or selection.
 */
export interface CascaderActionItem {
	/** Stable key. Falls back to the label when it is a string, then the position. */
	readonly value?: string | undefined;
	readonly label: React.ReactNode;
	readonly icon?: React.ReactNode;
	readonly disabled?: boolean | undefined;
	/** Ignored when `items` is present - a flyout opens instead. */
	readonly onSelect?: (() => void) | undefined;
	/** Turns the row into a submenu trigger. One level deep on purpose. */
	readonly items?: readonly CascaderActionItem[] | undefined;
	/** Consecutive entries sharing a heading are drawn under one. */
	readonly group?: string | undefined;
}

/** Panel layout. See the docs for the keyboard map of each. */
export type CascaderMode = "drill" | "columns" | "tree";

export type CascaderSearchScope = "level" | "deep" | "global";

/** Which nodes may be committed: leaves only, any node, or the caller's predicate over its typed node. */
export type CascaderSelectable<TData = undefined> = "leaf" | "any" | ((node: CascaderNode<TData>) => boolean);

export type CascaderCollapse = "middle" | "start" | "none";

export type CascaderValueDisplay = "path" | "leaf" | "count";

export type CascaderChangeReason = "select" | "deselect" | "clear";

/** The control density, shared by the trigger, the chips, the search field and the rows. */
export type CascaderSize = "sm" | "default" | "lg";

/** Writing direction, as the keyboard hint is worded for it. */
export type CascaderDirection = "ltr" | "rtl";

/** Second argument to `onValueChange`: resolved nodes, so no re-lookup. */
export interface CascaderChangeDetails<TData = undefined> {
	/** The node committed or toggled. Null when the selection was cleared. */
	readonly node: CascaderNode<TData> | null;
	/** Ancestor chain of `node`, root first, node last. */
	readonly path: readonly CascaderNode<TData>[];
	readonly nodes: readonly CascaderNode<TData>[];
	readonly reason: CascaderChangeReason;
}

/** Normalized tree, built once per `items` identity, shared by every mode. */
export interface CascaderIndex<TNode extends CascaderNodeBase = CascaderNodeBase> {
	readonly byValue: ReadonlyMap<string, TNode>;
	/** Children by parent value. Root children are keyed by `CASCADER_ROOT_KEY`. */
	readonly childrenOf: ReadonlyMap<string, readonly TNode[]>;
	readonly parentOf: ReadonlyMap<string, string | null>;
	/** Zero-based depth by node value. */
	readonly depthOf: ReadonlyMap<string, number>;
	/** Top level nodes, in input order. */
	readonly roots: readonly TNode[];
	/** Every node in a stable, depth-first order. Used by deep search. */
	readonly all: readonly TNode[];
	/** Resolved chain nodes listed last in a level that may still return them. */
	readonly pinned?: ReadonlySet<string> | undefined;
	/** Resolved chain nodes whose level loaded completely without them: they keep their path for the trigger, and are no row, hit or cascade child. */
	readonly hidden?: ReadonlySet<string> | undefined;
	/** Values some resolved chain names as a parent: they read as branches whatever their own flags say. */
	readonly branches?: ReadonlySet<string> | undefined;
}

export interface CascaderFlatNode<TNode extends CascaderNodeBase = CascaderNodeBase> {
	readonly node: TNode;
	readonly depth: number;
	/** Known children, or a declared `hasChildren`. */
	readonly branch: boolean;
	readonly expanded: boolean;
	/** Sibling count, plus one when the level has a paging row. */
	readonly setSize: number;
	/** One-based position among siblings. */
	readonly posInSet: number;
}

/** One segment of a rendered path, after collapsing. */
export type CascaderPathSegment<TNode extends CascaderNodeBase = CascaderNodeBase> =
	{ readonly type: "node"; readonly node: TNode } | { readonly type: "ellipsis"; readonly hidden: readonly TNode[] };

/**
 * Async load state for one node's children. Deliberately WITHOUT a `status`
 * field: "declared a branch, never fetched" and "fetched and genuinely empty"
 * are told apart by MAP MEMBERSHIP, and a second source of that truth would
 * eventually disagree with the first.
 */
export interface CascaderLoadState {
	readonly loading: boolean;
	readonly error: boolean;
	readonly hasMore: boolean;
	/** Opaque cursor handed back to `getChildren` for the next page. */
	readonly cursor?: string | undefined;
}

/** Why a level was fetched. `resolve`: `resolveValue` hit an unloaded node. */
export type CascaderLoadReason = "level" | "more" | "prefetch" | "retry" | "resolve";

/** Why a load failed, as `onLoadError` reports it: a level fetch, the server search or a value resolve. */
export type CascaderLoadErrorReason = CascaderLoadReason | "search";

/** Second argument to `onLoadError`. `parent` is the level (`null` for the root). */
export interface CascaderLoadErrorContext {
	readonly parent: string | null;
	readonly reason: CascaderLoadErrorReason;
}

/** Argument handed to `getChildren` and `resolveValue`. */
export interface CascaderLoadContext {
	/**
	 * Aborted when the request is superseded, `loadKey` changes or the cascader
	 * unmounts, and for a `getChildren` load also when the popup closes.
	 */
	readonly signal: AbortSignal;
	readonly cursor?: string | undefined;
	readonly reason?: CascaderLoadReason | undefined;
}

/** Value returned by `getChildren`. A bare array is also accepted. */
export interface CascaderLoadResult<TData = undefined> {
	readonly items: readonly CascaderNode<TData>[];
	readonly nextCursor?: string | undefined;
	/** Defaults to whether `nextCursor` was supplied. */
	readonly hasMore?: boolean | undefined;
}

/** Argument handed to `onSearch`. */
export interface CascaderSearchContext {
	readonly signal: AbortSignal;
	/** The path the user is searching within, deepest last. Empty under a global search, whose scope is the whole tree. */
	readonly path: readonly string[];
}

/**
 * Every user facing string, so the primitive ships no hardcoded copy — the
 * `cascader` family of `UiKitLabels`, read from `UiKitLabelsProvider`. The
 * callbacks take plain labels, not nodes, so the family carries no generic.
 * `*Announcement` is live-region copy.
 */
export interface CascaderLabels {
	/** The search placeholder. A function receives the level's parent label, absent at the root and under a global search. */
	readonly search: string | ((parentLabel: string | undefined) => string);
	readonly back: string;
	/** A level's FIRST page. `loadingMore` is the next, `loadMore` its idle row. */
	readonly loading: string;
	readonly loadingMore: string;
	readonly loadMore: string;
	readonly error: string;
	readonly retry: string;
	readonly empty: string;
	/** Rendered by `CascaderValue` when `display="count"`. */
	readonly selectedCount: (count: number) => string;
	readonly breadcrumbLabel: string;
	readonly chipsLabel: string;
	readonly removeChip: (label: string) => string;
	/** Trail separator. Not every locale writes one with a slash. */
	readonly pathSeparator: string;
	/** Names the root level wherever there is no parent node to name it. */
	readonly rootLevel: string;
	readonly itemCount: (count: number) => string;
	/** Appended to a branch row's name outside tree mode: it opens another list. */
	readonly branchAffordance: string;
	/** Columns-trail rows are plain buttons, so they carry no `aria-selected`. */
	readonly selectedState: string;
	/** Same for the mixed state, which a `role="button"` row may not carry. */
	readonly partiallySelectedState: string;
	readonly columnsLabel: string;
	readonly actionsLabel: string;
	readonly submenuAffordance: string;
	readonly panelLabel: string;
	/** Read per mode AND per direction: the level keys mirror in RTL. */
	readonly keyboardHint: (mode: CascaderMode, dir: CascaderDirection) => string;
	readonly rootAnnouncement: (count: number) => string;
	readonly expandedAnnouncement: (label: string, count: number) => string;
	readonly collapsedAnnouncement: (label: string) => string;
	readonly levelAnnouncement: (parentLabel: string, depth: number, count: number) => string;
	readonly resultsAnnouncement: (count: number) => string;
	readonly maxReachedAnnouncement: (max: number) => string;
	/** `count` is the descendants swept along; `selecting` is the direction. */
	readonly cascadeAnnouncement: (label: string, count: number, selecting: boolean) => string;
	readonly searchingAnnouncement: string;
}
