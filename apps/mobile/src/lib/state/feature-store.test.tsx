import { act, render, renderHook, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text } from "react-native";

import { createFeatureStore } from "./feature-store";
import { createFeatureStoreContext, MissingFeatureStoreError } from "./feature-store-context";

type CounterAction = { readonly type: "[ Counter ] Incremented" } | { readonly type: "[ Counter ] Reset" };

interface CounterState {
	readonly count: number;
	readonly label: string;
}

function counterReducer(state: CounterState, action: CounterAction): CounterState {
	return action.type === "[ Counter ] Incremented" ? { ...state, count: state.count + 1 } : { ...state, count: 0 };
}

const INITIAL: CounterState = { count: 0, label: "counter" };

describe("createFeatureStore", () => {
	it("changes state only through the reducer and runs effects afterwards with the new state", () => {
		const seen: number[] = [];
		const store = createFeatureStore<CounterState, CounterAction>({
			initialState: INITIAL,
			reducer: counterReducer,
			effects: [
				(action, { getState }): void => {
					if (action.type === "[ Counter ] Incremented") {
						seen.push(getState().count);
					}
				},
			],
		});

		store.dispatch({ type: "[ Counter ] Incremented" });
		store.dispatch({ type: "[ Counter ] Incremented" });
		store.dispatch({ type: "[ Counter ] Reset" });

		expect(store.getState()).toEqual({ count: 0, label: "counter" });
		expect(seen).toEqual([1, 2]);
	});

	it("lets an effect dispatch a follow-up action", () => {
		const store = createFeatureStore<CounterState, CounterAction>({
			initialState: INITIAL,
			reducer: counterReducer,
			effects: [
				(action, { dispatch, getState }): void => {
					if (action.type === "[ Counter ] Incremented" && getState().count === 2) {
						dispatch({ type: "[ Counter ] Reset" });
					}
				},
			],
		});

		store.dispatch({ type: "[ Counter ] Incremented" });
		store.dispatch({ type: "[ Counter ] Incremented" });

		expect(store.getState().count).toBe(0);
	});

	it("notifies subscribers", () => {
		const store = createFeatureStore<CounterState, CounterAction>({ initialState: INITIAL, reducer: counterReducer });
		const listener = jest.fn();
		const unsubscribe = store.subscribe(listener);

		store.dispatch({ type: "[ Counter ] Incremented" });
		unsubscribe();
		store.dispatch({ type: "[ Counter ] Incremented" });

		expect(listener).toHaveBeenCalledTimes(1);
	});
});

describe("createFeatureStoreContext", () => {
	const counter = createFeatureStoreContext<CounterState, CounterAction>("Counter");

	function Count(): React.JSX.Element {
		const count = counter.useFeatureSelector((state: CounterState): number => state.count);
		return <Text>{`count ${String(count)}`}</Text>;
	}

	it("re-renders a selector consumer when its slice changes", async () => {
		const store = createFeatureStore<CounterState, CounterAction>({ initialState: INITIAL, reducer: counterReducer });
		await render(
			<counter.provider store={store}>
				<Count />
			</counter.provider>,
		);

		expect(screen.getByText("count 0")).toBeOnTheScreen();
		await act((): void => {
			store.dispatch({ type: "[ Counter ] Incremented" });
		});
		expect(screen.getByText("count 1")).toBeOnTheScreen();
	});

	it("refuses a facade hook outside its provider", async () => {
		await expect(renderHook(() => counter.useFeatureStore())).rejects.toBeInstanceOf(MissingFeatureStoreError);
	});
});
