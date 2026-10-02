"use client";

import * as React from "react";
import { useStore } from "zustand";

import type { FeatureAction, FeatureStore } from "./feature-store";

export interface FeatureStoreProviderProps<TState, TAction extends FeatureAction> {
	/** Builds this provider's store — called once per mount (per request on the server, once per tab in the browser). */
	readonly createStore: () => FeatureStore<TState, TAction>;
	/** Runs once after mount with the store (persistence, subscriptions); returns its cleanup. */
	readonly onMount?: (store: FeatureStore<TState, TAction>) => () => void;
	readonly children: React.ReactNode;
}

export interface FeatureStoreContext<TState, TAction extends FeatureAction> {
	readonly provider: (props: FeatureStoreProviderProps<TState, TAction>) => React.JSX.Element;
	/** The store of the nearest provider — for facades only (dispatch + selector hooks). */
	readonly useFeatureStore: () => FeatureStore<TState, TAction>;
	/** Subscribes to ONE selected value; re-renders only when it changes (`Object.is`). */
	readonly useFeatureSelector: <TSelected>(selector: (state: TState) => TSelected) => TSelected;
}

/**
 * React binding for a feature store. Mount the provider at a PERSISTENT layout
 * boundary (a layout, not a page) so ordinary client navigation keeps the
 * state; the store is created once per provider mount — never per render and
 * never at module scope.
 */
export function createFeatureStoreContext<TState, TAction extends FeatureAction>(featureName: string): FeatureStoreContext<TState, TAction> {
	const Context = React.createContext<FeatureStore<TState, TAction> | null>(null);
	Context.displayName = `${featureName}StoreContext`;

	function Provider({ createStore, onMount, children }: FeatureStoreProviderProps<TState, TAction>): React.JSX.Element {
		const [store] = React.useState(createStore);
		const onMountRef = React.useRef(onMount);

		React.useEffect(() => {
			const onMountOnce = onMountRef.current;
			return onMountOnce === undefined ? undefined : onMountOnce(store);
		}, [store]);

		return <Context.Provider value={store}>{children}</Context.Provider>;
	}

	function useFeatureStore(): FeatureStore<TState, TAction> {
		const store = React.useContext(Context);
		if (store === null) {
			throw new Error(`${featureName} store is missing — render inside its provider`);
		}
		return store;
	}

	function useFeatureSelector<TSelected>(selector: (state: TState) => TSelected): TSelected {
		return useStore(useFeatureStore().api, selector);
	}

	return { provider: Provider, useFeatureStore, useFeatureSelector };
}
