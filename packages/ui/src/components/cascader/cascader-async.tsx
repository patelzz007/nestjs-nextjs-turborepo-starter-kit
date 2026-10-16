"use client";

import { isArrayValue } from "@workspace/shared";
import { useCascaderState } from "@workspace/ui/components/cascader/cascader-context";
import { CASCADER_ROOT_KEY, isCascaderMoreNode } from "@workspace/ui/components/cascader/cascader-lib";
import type {
	CascaderIndex,
	CascaderLoadContext,
	CascaderLoadErrorContext,
	CascaderLoadReason,
	CascaderLoadResult,
	CascaderLoadState,
	CascaderNode,
	CascaderSearchContext,
} from "@workspace/ui/components/cascader/cascader-types";
import * as React from "react";

/**
 * Async data for the cascader. Loaded pages live in their own store and are
 * MERGED onto the index built from `items`, never folded into that build:
 * `items` changes identity on any parent re-render, and folding would discard
 * every level the user drilled into. Map membership is the load discriminator:
 * no `states` entry means never fetched, while an entry with no `loading`, no
 * `error` and no children means empty for real.
 *
 * The request machinery is an external store (`CascaderLoaderClient`) read with
 * `useSyncExternalStore`: abort controllers, request ids and latches are
 * request bookkeeping, not render state, and effects drive the client rather
 * than calling `setState` themselves. The loader functions are the CALLER's —
 * the cascader only calls what it is given.
 */

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

/** What a loader may answer: the nodes, or a page with a cursor. */
export type CascaderChildrenResult<TData = undefined> = readonly CascaderNode<TData>[] | CascaderLoadResult<TData>;

/**
 * Fetches one level. `node` is `null` for the root level, and only
 * `{ value, label: value }`, no `data`, for a level on screen whose node has
 * not loaded: a deep link before the level above loads, or a page-loaded
 * level after a `loadKey` change.
 */
export type CascaderGetChildren<TData = undefined> = (
	node: CascaderNode<TData> | null,
	context: CascaderLoadContext,
) => CascaderChildrenResult<TData> | Promise<CascaderChildrenResult<TData>>;

/** Server-side search, replacing the local index scan while the query is set. */
export type CascaderOnSearch<TData = undefined> = (query: string, context: CascaderSearchContext) => CascaderChildrenResult<TData> | Promise<CascaderChildrenResult<TData>>;

/** Resolves a selected value to its ancestor chain, root first, node last. */
export type CascaderResolveValue<TData = undefined> = (
	value: string,
	context: CascaderLoadContext,
) => readonly CascaderNode<TData>[] | Promise<readonly CascaderNode<TData>[]>;

/** Called when a load fails. Never for an aborted or superseded request. The error is whatever the caller's loader threw. */
export type CascaderLoadErrorHandler = (error: Error, context: CascaderLoadErrorContext) => void;

export interface CascaderLoaderStore<TData = undefined> {
	/** Keyed by LEVEL: a parent's value, or `CASCADER_ROOT_KEY` for the root. */
	readonly pages: ReadonlyMap<string, readonly CascaderNode<TData>[]>;
	readonly states: ReadonlyMap<string, CascaderLoadState>;
	/** Keyed by node value: search hits and resolved selections, level-less. */
	readonly detached: ReadonlyMap<string, CascaderNode<TData>>;
	/** A resolved chain's parent links, node value to level key. Kept apart from `pages`, so a level's first real page cannot drop the trigger's path. */
	readonly links: ReadonlyMap<string, string>;
}

interface CascaderSearchSlice<TData> {
	readonly query: string;
	readonly results: readonly CascaderNode<TData>[];
	readonly loading: boolean;
	readonly error: boolean;
}

interface CascaderLoaderSnapshot<TData> {
	readonly store: CascaderLoaderStore<TData>;
	readonly search: CascaderSearchSlice<TData> | null;
}

export interface UseCascaderLoaderOptions<TData = undefined> {
	/** The index built from `items`, before any pages are merged in. */
	readonly base: CascaderIndex<CascaderNode<TData>>;
	readonly getChildren?: CascaderGetChildren<TData> | undefined;
	readonly onSearch?: CascaderOnSearch<TData> | undefined;
	readonly resolveValue?: CascaderResolveValue<TData> | undefined;
	/** Milliseconds of quiet before `onSearch` fires. */
	readonly searchDebounce?: number | undefined;
	/** Changing this drops every cached page, state and detached node. Compared with `Object.is`. */
	readonly loadKey?: string | number | boolean | null | undefined;
	/** Speculatively fetch a branch's children when it is highlighted. */
	readonly prefetch?: boolean | undefined;
	readonly onLoadError?: CascaderLoadErrorHandler | undefined;
	/** Called when a level's request lands (not when it fails, is aborted or is superseded). */
	readonly onLevelSettled?: ((key: string) => void) | undefined;
	/** Whether the panel is live: the popup is open, or the cascader is inline. Gates levels, paging and search; `resolveValue` runs regardless. */
	readonly enabled: boolean;
	readonly query: string;
	/** Level keys that are currently on screen. Root is `CASCADER_ROOT_KEY`. */
	readonly levels: readonly string[];
	/** Handed to `onSearch` as its scope: the navigation path, or `[]` when the search covers the whole tree. */
	readonly path: readonly string[];
	/** Current selection, for `resolveValue`. */
	readonly values: readonly string[];
}

export interface CascaderLoader<TData = undefined> {
	/** Whether a `getChildren` loader is configured at all. */
	readonly active: boolean;
	readonly store: CascaderLoaderStore<TData>;
	readonly states: ReadonlyMap<string, CascaderLoadState>;
	/** Async search hits, `null` when no `onSearch` is running. EMPTY while the first request is in flight, so the level behind is not shown as the answer. */
	readonly searchResults: readonly CascaderNode<TData>[] | null;
	readonly searchState: CascaderLoadState | null;
	/** Fetches a level's FIRST page. No-ops on a `states` entry (in flight, loaded or failed) or when `items` fills the level. */
	readonly ensureLevel: (parentKey: string, reason: CascaderLoadReason) => void;
	/** Fetches the next page of a level. No-ops unless one is available. */
	readonly loadMore: (parentKey: string) => void;
	/** Refires a failed level. No-ops unless that level is in an error state. */
	readonly retryLevel: (parentKey: string) => void;
	/** Refires the server search for the current query. No-ops without one. */
	readonly retrySearch: () => void;
	/** Schedules a speculative fetch. Safe to call on every highlight move. */
	readonly prefetchNode: (node: CascaderNode<TData> | null) => void;
	/** Evicts ONE level: aborts its request, drops its `states`/`pages` entries and paging latch. `null` = root level. */
	readonly invalidateLevel: (value: string | null) => void;
}

/* -------------------------------------------------------------------------- */
/*                                  Constants                                 */
/* -------------------------------------------------------------------------- */

/** Highlight dwell before `prefetch` fetches: long enough that holding ArrowDown does not fire a request per row. */
export const CASCADER_PREFETCH_DELAY_MS = 150;

/** Default quiet time before `onSearch` fires. */
export const CASCADER_SEARCH_DEBOUNCE_MS = 250;

/** Request keys for the two non-level requests. Never collide with a value. */
const SEARCH_KEY = "\u0000search";
const RESOLVE_PREFIX = "\u0000resolve:";

const NO_STATE: CascaderLoadState = { loading: false, error: false, hasMore: false };

function createStore<TData>(): CascaderLoaderStore<TData> {
	return { pages: new Map(), states: new Map(), detached: new Map(), links: new Map() };
}

function sameLoadState(left: CascaderLoadState, right: CascaderLoadState): boolean {
	return left.loading === right.loading && left.error === right.error && left.hasMore === right.hasMore && left.cursor === right.cursor;
}

/** The message of the `Error` that wraps a non-`Error` rejection from a caller's loader. Developer-facing, never rendered. */
const LOAD_FAILURE_MESSAGE = "Cascader load failed";

function isNodeList<TData>(result: CascaderChildrenResult<TData>): result is readonly CascaderNode<TData>[] {
	return isArrayValue(result);
}

interface NormalizedPage<TData> {
	readonly items: readonly CascaderNode<TData>[];
	readonly nextCursor: string | undefined;
	readonly hasMore: boolean;
}

function normalizePage<TData>(result: CascaderChildrenResult<TData>): NormalizedPage<TData> {
	if (isNodeList(result)) {
		return { items: result, nextCursor: undefined, hasMore: false };
	}
	return { items: result.items, nextCursor: result.nextCursor, hasMore: result.hasMore ?? result.nextCursor !== undefined };
}

/* -------------------------------------------------------------------------- */
/*                              Store transitions                             */
/* -------------------------------------------------------------------------- */

/** Copy-on-write, and a NO-OP when nothing changed: the merged index is memoised on the maps' identity. */
function withLoadState<TData>(store: CascaderLoaderStore<TData>, key: string, update: (state: CascaderLoadState) => CascaderLoadState): CascaderLoaderStore<TData> {
	const current = store.states.get(key) ?? NO_STATE;
	const next = update(current);
	if (store.states.has(key) && sameLoadState(current, next)) {
		return store;
	}
	const states = new Map(store.states);
	states.set(key, next);
	return { ...store, states };
}

interface PageOptions {
	readonly append: boolean;
	readonly hasMore: boolean;
	readonly cursor: string | undefined;
}

function withPage<TData>(store: CascaderLoaderStore<TData>, key: string, items: readonly CascaderNode<TData>[], options: PageOptions): CascaderLoaderStore<TData> {
	const previous = options.append ? (store.pages.get(key) ?? []) : [];
	const seen = new Set(previous.map((node: CascaderNode<TData>): string => node.value));
	const merged = [...previous];
	for (const item of items) {
		if (!seen.has(item.value)) {
			seen.add(item.value);
			merged.push(item);
		}
	}

	const pages = new Map(store.pages);
	pages.set(key, merged);
	const states = new Map(store.states);
	states.set(key, { loading: false, error: false, hasMore: options.hasMore, cursor: options.cursor });
	return { ...store, pages, states };
}

function withDetached<TData>(store: CascaderLoaderStore<TData>, items: readonly CascaderNode<TData>[]): CascaderLoaderStore<TData> {
	let detached: Map<string, CascaderNode<TData>> | null = null;
	for (const item of items) {
		if (store.detached.get(item.value) !== item) {
			detached ??= new Map(store.detached);
			detached.set(item.value, item);
		}
	}
	return detached === null ? store : { ...store, detached };
}

/**
 * Records a resolved ancestor chain, root first, as `detached` nodes plus
 * `links`, never as rows in `pages`: a stub there made an unloaded level read
 * as loaded. Writes no `states`, so every level on it still fetches for real.
 */
function withChain<TData>(store: CascaderLoaderStore<TData>, chain: readonly CascaderNode<TData>[]): CascaderLoaderStore<TData> {
	if (chain.length === 0) {
		return store;
	}
	const detached = new Map(store.detached);
	const links = new Map(store.links);
	let parentKey = CASCADER_ROOT_KEY;
	for (const node of chain) {
		detached.set(node.value, node);
		links.set(node.value, parentKey);
		parentKey = node.value;
	}
	return { ...store, detached, links };
}

/* -------------------------------------------------------------------------- */
/*                                   Client                                   */
/* -------------------------------------------------------------------------- */

/** The client's view of the latest props, refreshed after every commit. */
interface CascaderLoaderClientOptions<TData> {
	readonly base: CascaderIndex<CascaderNode<TData>>;
	readonly getChildren: CascaderGetChildren<TData> | undefined;
	readonly onSearch: CascaderOnSearch<TData> | undefined;
	readonly resolveValue: CascaderResolveValue<TData> | undefined;
	readonly onLoadError: CascaderLoadErrorHandler | undefined;
	readonly onLevelSettled: ((key: string) => void) | undefined;
	readonly prefetch: boolean;
	readonly path: readonly string[];
	readonly query: string;
}

/** The loader's request machinery: one instance per cascader, read through `useSyncExternalStore`. */
export class CascaderLoaderClient<TData = undefined> {
	private _snapshot: CascaderLoaderSnapshot<TData> = { store: createStore(), search: null };
	private readonly _listeners = new Set<() => void>();
	private _options: CascaderLoaderClientOptions<TData> | null = null;
	/** One AbortController PER KEY: columns mode runs several levels at once. */
	private readonly _controllers = new Map<string, AbortController>();
	/** Monotonic per key. The stale guard for out-of-order responses. */
	private readonly _requestIds = new Map<string, number>();
	/** In-flight `(level, cursor)` signatures, so a duplicate ask is free. */
	private readonly _inflight = new Map<string, string>();
	/** The `(child count, cursor)` signature at the last paging fire, per level: a page of zero new items is not re-asked. */
	private readonly _moreLatch = new Map<string, string>();
	/** Values `resolveValue` has already been asked about, so it asks once. */
	private readonly _attempted = new Set<string>();
	/** Values whose resolve failed. They stay `attempted` until the next open, so an error handler that re-renders the parent cannot loop. */
	private readonly _failed = new Set<string>();
	/** Every node the loader has seen, so a level key can name its own node. */
	private readonly _known = new Map<string, CascaderNode<TData>>();
	private _prefetchTimer: ReturnType<typeof setTimeout> | null = null;
	/** Bumped by a `loadKey` change, so responses from before it are dropped. */
	private _epoch = 0;
	private _loadKey: { readonly key: UseCascaderLoaderOptions<TData>["loadKey"] } | null = null;

	public readonly subscribe = (listener: () => void): (() => void) => {
		this._listeners.add(listener);
		return (): void => {
			this._listeners.delete(listener);
		};
	};

	public readonly getSnapshot = (): CascaderLoaderSnapshot<TData> => this._snapshot;

	public setOptions(options: CascaderLoaderClientOptions<TData>): void {
		this._options = options;
	}

	/** Records the cache key; a change from the last one drops everything and aborts what is in flight. */
	public syncLoadKey(key: UseCascaderLoaderOptions<TData>["loadKey"]): void {
		const previous = this._loadKey;
		this._loadKey = { key };
		if (previous === null || Object.is(previous.key, key)) {
			return;
		}
		this._epoch += 1;
		for (const controller of this._controllers.values()) {
			controller.abort();
		}
		this._controllers.clear();
		this._inflight.clear();
		// `requestIds` is deliberately NOT cleared: monotonic ids keep the stale guard independent of the abort and the epoch.
		this._moreLatch.clear();
		this._attempted.clear();
		this._failed.clear();
		this._known.clear();
		this.clearPrefetchTimer();
		this.commit({ store: createStore(), search: null });
	}

	public ensureLevel(key: string, reason: CascaderLoadReason): void {
		const options = this._options;
		if (options?.getChildren === undefined) {
			return;
		}
		if (this._snapshot.store.states.has(key)) {
			return;
		}
		// A level `items` already fills is not the loader's business: a static root plus `getChildren` for the branches needs no flag.
		if (options.base.childrenOf.has(key)) {
			return;
		}
		this.runLoad(key, reason, undefined, false);
	}

	public loadMore(key: string): void {
		if (this._options?.getChildren === undefined) {
			return;
		}
		const { store } = this._snapshot;
		const state = store.states.get(key);
		if (state === undefined || state.loading || !state.hasMore) {
			return;
		}
		const loaded = store.pages.get(key)?.length ?? 0;
		const signature = `${String(loaded)}:${state.cursor ?? ""}`;
		if (this._moreLatch.get(key) === signature) {
			return;
		}
		this._moreLatch.set(key, signature);
		this.runLoad(key, "more", state.cursor, true);
	}

	public retryLevel(key: string): void {
		if (this._options?.getChildren === undefined) {
			return;
		}
		const { store } = this._snapshot;
		const state = store.states.get(key);
		if (state?.error !== true) {
			return;
		}
		const loaded = store.pages.get(key)?.length ?? 0;
		// A retry must be able to re-fire the page the latch just blocked.
		this._moreLatch.delete(key);
		this.runLoad(key, "retry", loaded > 0 ? state.cursor : undefined, loaded > 0);
	}

	/** `detached` and `links` are deliberately untouched: chains and search hits belong to no level. */
	public invalidateLevel(value: string | null): void {
		const key = value ?? CASCADER_ROOT_KEY;
		this.abortKey(key);
		// Bump the id too: a response past its signal check must still be stale.
		this._requestIds.set(key, (this._requestIds.get(key) ?? 0) + 1);
		this._moreLatch.delete(key);
		const { store } = this._snapshot;
		if (!store.states.has(key) && !store.pages.has(key)) {
			return;
		}
		const states = new Map(store.states);
		states.delete(key);
		const pages = new Map(store.pages);
		pages.delete(key);
		this.commitStore({ ...store, pages, states });
	}

	public prefetchNode(node: CascaderNode<TData> | null): void {
		const options = this._options;
		if (options === null || !options.prefetch || options.getChildren === undefined || node === null) {
			return;
		}
		if (isCascaderMoreNode(node) || node.hasChildren !== true || this._snapshot.store.states.has(node.value)) {
			return;
		}
		this.clearPrefetchTimer();
		// A TIMEOUT, not a direct call: `onItemHighlighted` fires from a layout effect.
		this._prefetchTimer = setTimeout((): void => {
			this._prefetchTimer = null;
			this.ensureLevel(node.value, "prefetch");
		}, CASCADER_PREFETCH_DELAY_MS);
	}

	public runSearch(text: string): void {
		const searcher = this._options?.onSearch;
		if (searcher === undefined) {
			return;
		}
		const path = this._options?.path ?? [];

		this.abortKey(SEARCH_KEY);
		const controller = new AbortController();
		this._controllers.set(SEARCH_KEY, controller);
		const requestId = (this._requestIds.get(SEARCH_KEY) ?? 0) + 1;
		this._requestIds.set(SEARCH_KEY, requestId);
		const startEpoch = this._epoch;

		this.commitSearch({ query: text, results: this._snapshot.search?.results ?? [], loading: true, error: false });

		const settle = (): void => {
			if (this._controllers.get(SEARCH_KEY) === controller) {
				this._controllers.delete(SEARCH_KEY);
			}
		};
		const stale = (): boolean => controller.signal.aborted || startEpoch !== this._epoch || requestId !== this._requestIds.get(SEARCH_KEY);

		// `Promise.resolve().then(...)`: it normalises a SYNCHRONOUS throw into a rejection instead of taking the render down.
		Promise.resolve()
			.then((): CascaderChildrenResult<TData> | Promise<CascaderChildrenResult<TData>> => searcher(text, { signal: controller.signal, path }))
			.then((result: CascaderChildrenResult<TData>): void => {
				settle();
				if (stale()) {
					return;
				}
				const { items } = normalizePage(result);
				this.remember(items);
				// Search hits go to `detached`, never a level: a hit lives anywhere in the tree.
				this._snapshot = { store: withDetached(this._snapshot.store, items), search: { query: text, results: items, loading: false, error: false } };
				this.emit();
			})
			.catch((error: unknown): void => {
				settle();
				if (stale()) {
					return;
				}
				this.commitSearch({ query: text, results: this._snapshot.search?.results ?? [], loading: false, error: true });
				this._options?.onLoadError?.(error instanceof Error ? error : new Error(LOAD_FAILURE_MESSAGE, { cause: error }), { parent: null, reason: "search" });
			});
	}

	public retrySearch(): void {
		const text = this._options?.query.trim() ?? "";
		if (text !== "") {
			this.runSearch(text);
		}
	}

	public clearSearch(): void {
		this.abortKey(SEARCH_KEY);
		if (this._snapshot.search !== null) {
			this.commitSearch(null);
		}
	}

	/** Asks `resolveValue` about every selected value the loader has never seen. Runs with the popup closed too. */
	public resolveValues(values: readonly string[]): void {
		const options = this._options;
		if (options?.resolveValue === undefined) {
			return;
		}
		for (const value of values) {
			if (value === "" || this._attempted.has(value) || options.base.byValue.has(value) || this._known.has(value)) {
				continue;
			}
			this._attempted.add(value);
			this.runResolve(value);
		}
	}

	/** Opening is the retry point for a failed resolve: un-ask it, so the next values pass asks again. */
	public reopen(): void {
		for (const value of this._failed) {
			this._attempted.delete(value);
		}
		this._failed.clear();
	}

	/**
	 * Aborts what the PANEL asked for. A resolve keeps running: it feeds the
	 * trigger, which shows with the popup closed. The cache stays: reopening onto
	 * an already-loaded level is the point of keeping it.
	 */
	public cancelPanel(): void {
		const keys = Array.from(this._controllers.keys()).filter((key: string): boolean => !key.startsWith(RESOLVE_PREFIX));
		for (const key of keys) {
			this._controllers.get(key)?.abort();
			this._controllers.delete(key);
		}
		this._inflight.clear();
		this.clearPrefetchTimer();
		if (keys.length === 0) {
			return;
		}

		const { store, search } = this._snapshot;
		let states: Map<string, CascaderLoadState> | null = null;
		for (const key of keys) {
			const state = store.states.get(key);
			if (state?.loading !== true) {
				continue;
			}
			states ??= new Map(store.states);
			if ((store.pages.get(key)?.length ?? 0) > 0) {
				states.set(key, { ...state, loading: false });
			} else {
				// No entry AT ALL: membership is what says "loaded", so a stranded `loading: true` would read as loaded-and-empty forever.
				states.delete(key);
			}
		}
		this._snapshot = {
			store: states === null ? store : { ...store, states },
			search: search?.loading === true ? { ...search, loading: false } : search,
		};
		this.emit();
	}

	/** Unmount: abort everything and forget the bookkeeping, so a StrictMode remount starts clean. */
	public dispose(): void {
		for (const controller of this._controllers.values()) {
			controller.abort();
		}
		this._controllers.clear();
		this._inflight.clear();
		this._requestIds.clear();
		this._attempted.clear();
		this._failed.clear();
		this.clearPrefetchTimer();
	}

	private runLoad(key: string, reason: CascaderLoadReason, cursor: string | undefined, append: boolean): void {
		const options = this._options;
		const loader = options?.getChildren;
		if (options === null || loader === undefined) {
			return;
		}

		const signature = `${append ? "1" : "0"}:${cursor ?? ""}`;
		if (this._inflight.get(key) === signature) {
			return;
		}

		this.abortKey(key);
		const controller = new AbortController();
		this._controllers.set(key, controller);
		this._inflight.set(key, signature);

		const requestId = (this._requestIds.get(key) ?? 0) + 1;
		this._requestIds.set(key, requestId);
		const startEpoch = this._epoch;

		// A deep link can put a level on screen before the level above it loads, and a `loadKey` reset forgets every node.
		const node: CascaderNode<TData> | null = key === CASCADER_ROOT_KEY ? null : (options.base.byValue.get(key) ?? this._known.get(key) ?? { value: key, label: key });

		this.commitStore(withLoadState(this._snapshot.store, key, (state: CascaderLoadState): CascaderLoadState => ({ ...state, loading: true, error: false })));

		const settle = (): void => {
			if (this._inflight.get(key) === signature) {
				this._inflight.delete(key);
			}
			if (this._controllers.get(key) === controller) {
				this._controllers.delete(key);
			}
		};
		const stale = (): boolean => controller.signal.aborted || startEpoch !== this._epoch || requestId !== this._requestIds.get(key);

		Promise.resolve()
			.then((): CascaderChildrenResult<TData> | Promise<CascaderChildrenResult<TData>> => loader(node, { signal: controller.signal, cursor, reason }))
			.then((result: CascaderChildrenResult<TData>): void => {
				settle();
				if (stale()) {
					return;
				}
				const page = normalizePage(result);
				if (!append) {
					this._moreLatch.delete(key);
				}
				this.remember(page.items);
				this.commitStore(withPage(this._snapshot.store, key, page.items, { append, hasMore: page.hasMore, cursor: page.nextCursor }));
				this._options?.onLevelSettled?.(key);
			})
			.catch((error: unknown): void => {
				settle();
				if (stale()) {
					return;
				}
				this.commitStore(withLoadState(this._snapshot.store, key, (state: CascaderLoadState): CascaderLoadState => ({ ...state, loading: false, error: true })));
				// Behind the stale guard: an abort is navigation, not a failure.
				this._options?.onLoadError?.(error instanceof Error ? error : new Error(LOAD_FAILURE_MESSAGE, { cause: error }), {
					parent: key === CASCADER_ROOT_KEY ? null : key,
					reason,
				});
			});
	}

	private runResolve(value: string): void {
		const resolver = this._options?.resolveValue;
		if (resolver === undefined) {
			return;
		}

		const key = `${RESOLVE_PREFIX}${value}`;
		this.abortKey(key);
		const controller = new AbortController();
		this._controllers.set(key, controller);
		const startEpoch = this._epoch;

		const settle = (): void => {
			if (this._controllers.get(key) === controller) {
				this._controllers.delete(key);
			}
		};

		Promise.resolve()
			.then((): readonly CascaderNode<TData>[] | Promise<readonly CascaderNode<TData>[]> => resolver(value, { signal: controller.signal, reason: "resolve" }))
			.then((chain: readonly CascaderNode<TData>[]): void => {
				settle();
				if (controller.signal.aborted || startEpoch !== this._epoch || chain.length === 0) {
					return;
				}
				this.remember(chain);
				this.commitStore(withChain(this._snapshot.store, chain));
			})
			.catch((error: unknown): void => {
				// Read BEFORE `settle`: a newer ask or a reset that replaced this request owns the value's retry.
				const live = this._controllers.get(key) === controller;
				settle();
				if (live) {
					this._failed.add(value);
				}
				if (controller.signal.aborted || startEpoch !== this._epoch) {
					return;
				}
				this._options?.onLoadError?.(error instanceof Error ? error : new Error(LOAD_FAILURE_MESSAGE, { cause: error }), { parent: null, reason: "resolve" });
			});
	}

	private remember(nodes: readonly CascaderNode<TData>[]): void {
		for (const node of nodes) {
			this._known.set(node.value, node);
			if (node.children !== undefined && node.children.length > 0) {
				this.remember(node.children);
			}
		}
	}

	private abortKey(key: string): void {
		const controller = this._controllers.get(key);
		if (controller === undefined) {
			return;
		}
		this._controllers.delete(key);
		this._inflight.delete(key);
		controller.abort();
	}

	private clearPrefetchTimer(): void {
		if (this._prefetchTimer !== null) {
			clearTimeout(this._prefetchTimer);
			this._prefetchTimer = null;
		}
	}

	private commit(next: CascaderLoaderSnapshot<TData>): void {
		this._snapshot = next;
		this.emit();
	}

	private commitStore(store: CascaderLoaderStore<TData>): void {
		if (store === this._snapshot.store) {
			return;
		}
		this.commit({ ...this._snapshot, store });
	}

	private commitSearch(search: CascaderSearchSlice<TData> | null): void {
		this.commit({ ...this._snapshot, search });
	}

	private emit(): void {
		for (const listener of this._listeners) {
			listener();
		}
	}
}

/* -------------------------------------------------------------------------- */
/*                                    Hook                                    */
/* -------------------------------------------------------------------------- */

/**
 * The loader. A SIBLING of the `buildCascaderIndex` memo, never inside it: the
 * build stays pure in `items`, the merge pure in that build plus this store.
 */
export function useCascaderLoader<TData = undefined>({
	base,
	getChildren,
	onSearch,
	resolveValue,
	searchDebounce = CASCADER_SEARCH_DEBOUNCE_MS,
	loadKey,
	prefetch = false,
	onLoadError,
	onLevelSettled,
	enabled,
	query,
	levels,
	path,
	values,
}: UseCascaderLoaderOptions<TData>): CascaderLoader<TData> {
	const [client] = React.useState((): CascaderLoaderClient<TData> => new CascaderLoaderClient<TData>());
	const snapshot = React.useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot);

	// Latest props, handed over after every commit. Declared FIRST: effects run in declaration order, so the ones below see this commit.
	React.useEffect((): void => {
		client.setOptions({ base, getChildren, onSearch, resolveValue, onLoadError, onLevelSettled, prefetch, path, query });
	});

	// A `loadKey` change drops everything. Declared before the level effect, so a reset always lands before the levels are asked for again.
	React.useEffect((): void => {
		client.syncLoadKey(loadKey);
	}, [client, loadKey]);

	// Closing the popup aborts the panel's requests; opening is the retry point for a failed resolve.
	React.useEffect((): void => {
		if (enabled) {
			client.reopen();
		} else {
			client.cancelPanel();
		}
	}, [client, enabled]);

	React.useEffect(
		(): (() => void) => (): void => {
			client.dispose();
		},
		[client],
	);

	const hasLoader = getChildren !== undefined;
	const hasSearch = onSearch !== undefined;
	const hasResolve = resolveValue !== undefined;
	const trimmed = query.trim();
	const { store, search } = snapshot;

	// THE load trigger: one declarative effect on the levels on screen, not a call from a navigation, which a controlled `path` never touches.
	// `store` re-runs it after an eviction, so an on-screen level that was invalidated refetches at once.
	React.useEffect((): void => {
		if (!enabled || !hasLoader) {
			return;
		}
		for (const key of levels) {
			client.ensureLevel(key, "level");
		}
	}, [client, enabled, hasLoader, levels, store]);

	React.useEffect((): (() => void) | undefined => {
		if (!hasSearch) {
			return undefined;
		}
		if (!enabled || trimmed === "") {
			client.clearSearch();
			return undefined;
		}
		const timer = setTimeout((): void => {
			client.runSearch(trimmed);
		}, searchDebounce);
		return (): void => {
			clearTimeout(timer);
			client.clearSearch();
		};
	}, [client, hasSearch, enabled, trimmed, searchDebounce]);

	// NOT gated on `enabled`: the trigger shows the selection with the popup closed, so a saved value is pathed on load.
	React.useEffect((): void => {
		if (hasResolve) {
			client.resolveValues(values);
		}
	}, [client, enabled, hasResolve, values, base, loadKey]);

	const searchResults = React.useMemo((): readonly CascaderNode<TData>[] | null => {
		if (!hasSearch || trimmed === "") {
			return null;
		}
		if (search?.query !== trimmed) {
			return [];
		}
		return search.results;
	}, [hasSearch, trimmed, search]);

	const searchState = React.useMemo((): CascaderLoadState | null => {
		if (!hasSearch || trimmed === "") {
			return null;
		}
		const settled = search?.query === trimmed;
		return { loading: !settled || search.loading, error: settled && search.error, hasMore: false };
	}, [hasSearch, trimmed, search]);

	const ensureLevel = React.useCallback(
		(key: string, reason: CascaderLoadReason): void => {
			client.ensureLevel(key, reason);
		},
		[client],
	);
	const loadMore = React.useCallback(
		(key: string): void => {
			client.loadMore(key);
		},
		[client],
	);
	const retryLevel = React.useCallback(
		(key: string): void => {
			client.retryLevel(key);
		},
		[client],
	);
	const retrySearch = React.useCallback((): void => {
		client.retrySearch();
	}, [client]);
	const prefetchNode = React.useCallback(
		(node: CascaderNode<TData> | null): void => {
			client.prefetchNode(node);
		},
		[client],
	);
	const invalidateLevel = React.useCallback(
		(value: string | null): void => {
			client.invalidateLevel(value);
		},
		[client],
	);

	return React.useMemo(
		(): CascaderLoader<TData> => ({
			active: hasLoader,
			store,
			states: store.states,
			searchResults,
			searchState,
			ensureLevel,
			loadMore,
			retryLevel,
			retrySearch,
			invalidateLevel,
			prefetchNode,
		}),
		[hasLoader, store, searchResults, searchState, ensureLevel, loadMore, retryLevel, retrySearch, invalidateLevel, prefetchNode],
	);
}

/* -------------------------------------------------------------------------- */
/*                                  Consumers                                 */
/* -------------------------------------------------------------------------- */

/** One level's load state, `null` when never fetched. Omit for the root. */
export function useCascaderLoadState(parent?: string | null): CascaderLoadState | null {
	const { loadStates } = useCascaderState();
	return loadStates.get(parent ?? CASCADER_ROOT_KEY) ?? null;
}
