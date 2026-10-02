import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { connectFeaturePersistence, type FeatureStorage } from "./feature-persistence";
import { createFeatureStore, type FeatureEffect } from "./feature-store";

interface CounterState {
	readonly count: number;
	readonly lastSaved: number | null;
}

type CounterAction =
	| { readonly type: "[ Counter ] Incremented"; readonly by: number }
	| { readonly type: "[ Counter ] Saved"; readonly value: number }
	| { readonly type: "[ Counter ] Restored"; readonly count: number };

function counterReducer(state: CounterState, action: CounterAction): CounterState {
	switch (action.type) {
		case "[ Counter ] Incremented":
			return { ...state, count: state.count + action.by };
		case "[ Counter ] Saved":
			return { ...state, lastSaved: action.value };
		case "[ Counter ] Restored":
			return { ...state, count: action.count };
	}
}

const INITIAL: CounterState = { count: 0, lastSaved: null };

function memoryStorage(initial: Record<string, string> = {}): FeatureStorage & { readonly entries: Map<string, string> } {
	const entries = new Map(Object.entries(initial));
	return {
		entries,
		getItem: (key: string): string | null => entries.get(key) ?? null,
		setItem: (key: string, value: string): void => {
			entries.set(key, value);
		},
	};
}

describe("createFeatureStore", () => {
	it("changes state only through the reducer and notifies subscribers", () => {
		const store = createFeatureStore<CounterState, CounterAction>({ name: "Counter", initialState: INITIAL, reducer: counterReducer });
		const listener = vi.fn();
		store.subscribe(listener);

		store.dispatch({ type: "[ Counter ] Incremented", by: 2 });

		expect(store.getState().count).toBe(2);
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("runs effects after the reducer, with the new state, and lets them dispatch follow-up actions", () => {
		const saveEffect: FeatureEffect<CounterState, CounterAction> = (action, { getState, dispatch }) => {
			if (action.type === "[ Counter ] Incremented") {
				dispatch({ type: "[ Counter ] Saved", value: getState().count });
			}
		};
		const store = createFeatureStore<CounterState, CounterAction>({ name: "Counter", initialState: INITIAL, reducer: counterReducer, effects: [saveEffect] });

		store.dispatch({ type: "[ Counter ] Incremented", by: 3 });

		expect(store.getState()).toEqual({ count: 3, lastSaved: 3 });
	});

	it("gives every call its own instance — nothing is shared between stores", () => {
		const first = createFeatureStore<CounterState, CounterAction>({ name: "Counter", initialState: INITIAL, reducer: counterReducer });
		const second = createFeatureStore<CounterState, CounterAction>({ name: "Counter", initialState: INITIAL, reducer: counterReducer });

		first.dispatch({ type: "[ Counter ] Incremented", by: 1 });

		expect(second.getState().count).toBe(0);
	});
});

describe("connectFeaturePersistence", () => {
	const CountSchema = z.object({ count: z.number().int() });
	const options = {
		key: "counter",
		schema: CountSchema,
		select: (state: CounterState): z.output<typeof CountSchema> => ({ count: state.count }),
		restore: (persisted: z.output<typeof CountSchema>): CounterAction => ({ type: "[ Counter ] Restored", count: persisted.count }),
	};

	function store(): ReturnType<typeof createFeatureStore<CounterState, CounterAction>> {
		return createFeatureStore<CounterState, CounterAction>({ name: "Counter", initialState: INITIAL, reducer: counterReducer });
	}

	it("restores a valid snapshot through the feature's restore action", () => {
		const counter = store();

		connectFeaturePersistence(counter, memoryStorage({ counter: JSON.stringify({ count: 7 }) }), options);

		expect(counter.getState().count).toBe(7);
	});

	it("ignores snapshots that are not valid JSON or fail the schema", () => {
		const garbled = store();
		connectFeaturePersistence(garbled, memoryStorage({ counter: "{not json" }), options);
		const tampered = store();
		connectFeaturePersistence(tampered, memoryStorage({ counter: JSON.stringify({ count: "lots" }) }), options);

		expect(garbled.getState().count).toBe(0);
		expect(tampered.getState().count).toBe(0);
	});

	it("hands a value that is not JSON to the schema as the raw string, so a bare-string legacy value can be upgraded", () => {
		const legacyAware = {
			...options,
			schema: z.union([CountSchema, z.enum(["one", "two"]).transform((word): z.output<typeof CountSchema> => ({ count: word === "one" ? 1 : 2 }))]),
		};
		const upgraded = store();
		connectFeaturePersistence(upgraded, memoryStorage({ counter: "two" }), legacyAware);
		const rejected = store();
		connectFeaturePersistence(rejected, memoryStorage({ counter: "three" }), legacyAware);

		expect(upgraded.getState().count).toBe(2);
		expect(rejected.getState().count).toBe(0);
	});

	it("writes only when the persisted slice changes, and stops after disconnecting", () => {
		const counter = store();
		const storage = memoryStorage();
		const disconnect = connectFeaturePersistence(counter, storage, options);

		counter.dispatch({ type: "[ Counter ] Saved", value: 1 });
		expect(storage.entries.has("counter")).toBe(false);

		counter.dispatch({ type: "[ Counter ] Incremented", by: 4 });
		expect(storage.entries.get("counter")).toBe(JSON.stringify({ count: 4 }));

		disconnect();
		counter.dispatch({ type: "[ Counter ] Incremented", by: 1 });
		expect(storage.entries.get("counter")).toBe(JSON.stringify({ count: 4 }));
	});
});
