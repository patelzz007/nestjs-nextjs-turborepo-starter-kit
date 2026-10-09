// React binding of a feature store (ADR 023): one store per provider mount,
// narrow selector hooks, no whole-store subscriptions.

import * as React from "react";
import { useStore } from "zustand";

import type { FeatureAction, FeatureStore } from "./feature-store";

export interface FeatureStoreProviderProps<TState, TAction extends FeatureAction> {
	/** The store this provider owns — created by the caller once (it may also be used outside React). */
	readonly store: FeatureStore<TState, TAction>;
	readonly children: React.ReactNode;
}

export interface FeatureStoreContext<TState, TAction extends FeatureAction> {
	readonly provider: (props: FeatureStoreProviderProps<TState, TAction>) => React.JSX.Element;
	/** The store of the nearest provider — for facades only. */
	readonly useFeatureStore: () => FeatureStore<TState, TAction>;
	/** Subscribes to ONE selected value; re-renders only when it changes (`Object.is`). */
	readonly useFeatureSelector: <TSelected>(selector: (state: TState) => TSelected) => TSelected;
}

/** Thrown when a facade hook is used outside its provider — a wiring bug. */
export class MissingFeatureStoreError extends Error {
	public constructor(featureName: string) {
		super(`${featureName} store is missing — render inside its provider`);
		this.name = "MissingFeatureStoreError";
	}
}

export function createFeatureStoreContext<TState, TAction extends FeatureAction>(featureName: string): FeatureStoreContext<TState, TAction> {
	const Context = React.createContext<FeatureStore<TState, TAction> | null>(null);
	Context.displayName = `${featureName}StoreContext`;

	function Provider({ store, children }: FeatureStoreProviderProps<TState, TAction>): React.JSX.Element {
		return <Context.Provider value={store}>{children}</Context.Provider>;
	}

	function useFeatureStore(): FeatureStore<TState, TAction> {
		const store = React.useContext(Context);
		if (store === null) {
			throw new MissingFeatureStoreError(featureName);
		}
		return store;
	}

	function useFeatureSelector<TSelected>(selector: (state: TState) => TSelected): TSelected {
		return useStore(useFeatureStore().api, selector);
	}

	return { provider: Provider, useFeatureStore, useFeatureSelector };
}
