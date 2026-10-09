// ============================================
// feature-store.ts - NgRx-shaped Zustand feature stores (ADR 023), for React Native
// ============================================
// The same model as the web toolkit (packages/client/src/lib/state): state
// changes only by dispatching a named `[ Feature ] Event` action through a pure
// reducer, and effects run afterwards. The web toolkit cannot be imported here
// (@workspace/client is web-only); this is its React Native twin without the
// browser-only Redux DevTools bridge.

import { createStore, type StoreApi } from "zustand/vanilla";

/** A domain event: `type` reads `[ Feature ] Event`; any other fields are its payload. */
export interface FeatureAction {
	readonly type: string;
}

/** Pure, synchronous, deterministic: no I/O, no native APIs, no time or randomness. */
export type FeatureReducer<TState, TAction extends FeatureAction> = (state: TState, action: TAction) => TState;

export interface FeatureEffectContext<TState, TAction extends FeatureAction> {
	readonly getState: () => TState;
	readonly dispatch: (action: TAction) => void;
}

/** Runs after the reducer for every action — the only place a feature touches the outside world. */
export type FeatureEffect<TState, TAction extends FeatureAction> = (action: TAction, context: FeatureEffectContext<TState, TAction>) => void;

export interface FeatureStoreOptions<TState, TAction extends FeatureAction> {
	readonly initialState: TState;
	readonly reducer: FeatureReducer<TState, TAction>;
	readonly effects?: readonly FeatureEffect<TState, TAction>[];
}

export interface FeatureStore<TState, TAction extends FeatureAction> {
	readonly getState: () => TState;
	readonly dispatch: (action: TAction) => void;
	readonly subscribe: (listener: (state: TState, previousState: TState) => void) => () => void;
	/** The underlying Zustand store — for `useStore` bindings only; never set state through it. */
	readonly api: StoreApi<TState>;
}

/** Creates one feature store instance — once per provider mount, never at module scope. */
export function createFeatureStore<TState, TAction extends FeatureAction>(options: FeatureStoreOptions<TState, TAction>): FeatureStore<TState, TAction> {
	const api = createStore<TState>()((): TState => options.initialState);
	const effects = options.effects ?? [];

	const dispatch = (action: TAction): void => {
		api.setState(options.reducer(api.getState(), action), true);
		for (const effect of effects) {
			effect(action, { getState: api.getState, dispatch });
		}
	};

	return { getState: api.getState, dispatch, subscribe: api.subscribe, api };
}
