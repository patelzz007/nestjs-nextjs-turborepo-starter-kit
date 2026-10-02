import { devtools } from "zustand/middleware";
import { createStore, type StoreApi } from "zustand/vanilla";

import { RUNTIME_NODE_ENV } from "../api/config";
import { isServer } from "../is-server";

/**
 * A domain event: `type` reads `[ Feature ] Event` (e.g. `[ Sidebar ] Toggled`),
 * any other fields are its payload. Features declare their actions as a
 * discriminated union of these, so reducers switch exhaustively on `type`.
 */
export interface FeatureAction {
	readonly type: string;
}

/** Pure, synchronous, deterministic: no I/O, no browser APIs, no time or randomness. */
export type FeatureReducer<TState, TAction extends FeatureAction> = (state: TState, action: TAction) => TState;

export interface FeatureEffectContext<TState, TAction extends FeatureAction> {
	readonly getState: () => TState;
	readonly dispatch: (action: TAction) => void;
}

/**
 * Runs after the reducer for every action — the only place a feature touches
 * the outside world (cookies, query invalidation, navigation). Dependencies
 * (a QueryClient, a cookie writer) are closed over when the store is created,
 * so effects stay testable with fakes. Effects ignore actions they don't handle.
 */
export type FeatureEffect<TState, TAction extends FeatureAction> = (action: TAction, context: FeatureEffectContext<TState, TAction>) => void;

export interface FeatureStoreOptions<TState, TAction extends FeatureAction> {
	/** Redux DevTools instance name — one per feature store (e.g. `Sidebar · admin`). */
	readonly name: string;
	readonly initialState: TState;
	readonly reducer: FeatureReducer<TState, TAction>;
	readonly effects?: readonly FeatureEffect<TState, TAction>[];
}

/**
 * The NgRx-shaped core of a feature: state changes only by dispatching an
 * action through the pure reducer, effects react afterwards, and every action
 * appears in Redux DevTools (development only) with its payload.
 */
export interface FeatureStore<TState, TAction extends FeatureAction> {
	readonly getState: () => TState;
	readonly dispatch: (action: TAction) => void;
	readonly subscribe: (listener: (state: TState, previousState: TState) => void) => () => void;
	/** The underlying Zustand store — for `useStore` bindings only; never set state through it. */
	readonly api: StoreApi<TState>;
}

/** DevTools only in a development browser — never on the server (per-request stores) or in production. */
const DEVTOOLS_ENABLED: boolean = RUNTIME_NODE_ENV === "development" && !isServer;

/**
 * Creates one feature store instance. Call it once per provider mount (per
 * request on the server, once per tab in the browser) — never at module scope,
 * so server renders never share state between requests (rules/06).
 */
export function createFeatureStore<TState, TAction extends FeatureAction>(options: FeatureStoreOptions<TState, TAction>): FeatureStore<TState, TAction> {
	const api = createStore<TState>()(
		devtools((): TState => options.initialState, {
			name: options.name,
			enabled: DEVTOOLS_ENABLED,
		}),
	);
	const effects = options.effects ?? [];

	const dispatch = (action: TAction): void => {
		const nextState = options.reducer(api.getState(), action);
		// DevTools records `{ type, payload }`; the reducer always returns a whole state, so replace it.
		api.setState(nextState, true, { type: action.type, payload: action });
		for (const effect of effects) {
			effect(action, { getState: api.getState, dispatch });
		}
	};

	return {
		getState: api.getState,
		dispatch,
		subscribe: api.subscribe,
		api,
	};
}
