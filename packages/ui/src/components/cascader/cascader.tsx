"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { useCascaderLoader } from "@workspace/ui/components/cascader/cascader-async";
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
	CascaderHighlight,
	CascaderHighlightStore,
	CascaderItemState,
	CascaderRenderContextValue,
	CascaderRenderNode,
	CascaderStateContextValue,
} from "@workspace/ui/components/cascader/cascader-context";
import { useCascaderLabels } from "@workspace/ui/components/cascader/cascader-i18n";
import {
	applyCascadeSelection,
	buildCascaderIndex,
	CASCADER_ROOT_KEY,
	createCascaderMoreNode,
	filterCascaderLevel,
	flattenCascaderTree,
	getCascaderChildren,
	getCascaderCount,
	getCascaderIndeterminateFrom,
	getCascaderListedValues,
	getCascaderPath,
	getCascaderSelectedDescendants,
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
import { CASCADER_OVERSCAN, CASCADER_ESTIMATE_ROW_SIZE_PX } from "@workspace/ui/components/cascader/cascader-virtual";
import type {
	CascaderChangeDetails,
	CascaderChangeReason,
	CascaderFlatNode,
	CascaderIndex,
	CascaderLoadState,
	CascaderNode,
	CascaderNodeBase,
} from "@workspace/ui/components/cascader/cascader-types";
import * as React from "react";
import {
	ANNOUNCE_MARKER,
	CASCADER_ANNOUNCE_DEBOUNCE_MS,
	CASCADER_VIRTUALIZE_THRESHOLD,
	type CascaderAnnounceSignal,
	type CascaderAnnouncement,
	type CascaderBaseProps,
	type CascaderContextValue,
	type CascaderLatest,
	type CascaderPathChangeReason,
	type CascaderPendingNavigation,
	type CascaderProps,
	GLOBAL_SEARCH_PATH,
	NO_ACTIONS,
	NO_NODES,
	NO_VALUES,
	PAGING_KEY_SEPARATOR,
	createCascaderFrameStore,
	isItemEqualToValue,
	isNodeList,
	itemToStringLabel,
	itemToStringValue,
	retypeCascaderNode,
	sameValues,
	toSingleSelection,
	useControllable,
	withoutBlank,
} from "./cascader-model";
import { CascaderContent, CascaderEmpty, CascaderList, CascaderPanel, CascaderStatus } from "./cascader-popup";
import { CascaderChip, CascaderChips, CascaderTrigger } from "./cascader-trigger";

export {
	CASCADER_ANNOUNCE_DEBOUNCE_MS,
	CASCADER_VIRTUALIZE_THRESHOLD,
	type CascaderBaseProps,
	type CascaderContextValue,
	type CascaderMultipleProps,
	type CascaderOpenChangeDetails,
	type CascaderPathChangeDetails,
	type CascaderPathChangeReason,
	type CascaderProps,
	type CascaderSelection,
	type CascaderSingleProps,
	useCascaderSelection,
} from "./cascader-model";
export { type CascaderContentProps, type CascaderEmptyProps, type CascaderListProps, type CascaderPanelProps, type CascaderStatusProps } from "./cascader-popup";
export {
	type CascaderChipProps,
	type CascaderChipsProps,
	type CascaderTriggerProps,
	type CascaderTriggerVariant,
	cascaderChipsVariants,
	cascaderTriggerVariants,
	useCascaderAnchor,
} from "./cascader-trigger";

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
