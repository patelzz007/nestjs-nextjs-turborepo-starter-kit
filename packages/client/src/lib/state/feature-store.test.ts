import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
	connectFeaturePersistence,
	parseStoredJson,
	UNVERSIONED_STORAGE_FORMAT,
	type FeaturePersistenceOptions,
	type FeatureStorage,
	type FeatureStorageMigration,
} from "./feature-persistence";
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
	type CountSnapshot = z.output<typeof CountSchema>;
	const COUNT_VERSION = 2;

	/** Version 1 stored the count as a word; the step upgrades it to the version-2 shape. */
	const WordSchema = z.object({ schemaVersion: z.literal(1), snapshot: z.object({ word: z.enum(["one", "two"]) }) });
	const migrations: readonly FeatureStorageMigration<CountSnapshot>[] = [
		{
			fromVersion: UNVERSIONED_STORAGE_FORMAT,
			upgrade: (storedText: string): CountSnapshot | null => parseStoredJson(storedText, CountSchema),
		},
		{
			fromVersion: 1,
			upgrade: (storedText: string): CountSnapshot | null => {
				const stored = parseStoredJson(storedText, WordSchema);
				return stored === null ? null : { count: stored.snapshot.word === "one" ? 1 : 2 };
			},
		},
	];
	const options: FeaturePersistenceOptions<CounterState, CounterAction, CountSnapshot> = {
		key: "counter",
		version: COUNT_VERSION,
		schema: CountSchema,
		migrations,
		select: (state: CounterState): CountSnapshot => ({ count: state.count }),
		restore: (persisted: CountSnapshot): CounterAction => ({ type: "[ Counter ] Restored", count: persisted.count }),
	};

	function stored(version: number, snapshot: CountSnapshot): string {
		return JSON.stringify({ schemaVersion: version, snapshot });
	}

	function store(): ReturnType<typeof createFeatureStore<CounterState, CounterAction>> {
		return createFeatureStore<CounterState, CounterAction>({ name: "Counter", initialState: INITIAL, reducer: counterReducer });
	}

	it("restores a snapshot in the current version through the feature's restore action", () => {
		const counter = store();

		connectFeaturePersistence(counter, memoryStorage({ counter: stored(COUNT_VERSION, { count: 7 }) }), options);

		expect(counter.getState().count).toBe(7);
	});

	it("ignores stored text that is not JSON, fails the schema, or has a version with no migration", () => {
		const garbled = store();
		connectFeaturePersistence(garbled, memoryStorage({ counter: "{not json" }), options);
		const tampered = store();
		connectFeaturePersistence(tampered, memoryStorage({ counter: stored(COUNT_VERSION, { count: 1.5 }) }), options);
		const future = store();
		connectFeaturePersistence(future, memoryStorage({ counter: stored(COUNT_VERSION + 1, { count: 9 }) }), options);

		expect(garbled.getState().count).toBe(0);
		expect(tampered.getState().count).toBe(0);
		expect(future.getState().count).toBe(0);
	});

	it("upgrades an older format through the migration step for exactly that version", () => {
		const unversioned = store();
		connectFeaturePersistence(unversioned, memoryStorage({ counter: JSON.stringify({ count: 4 }) }), options);
		const versionOne = store();
		connectFeaturePersistence(versionOne, memoryStorage({ counter: JSON.stringify({ schemaVersion: 1, snapshot: { word: "two" } }) }), options);
		const unknownWord = store();
		connectFeaturePersistence(unknownWord, memoryStorage({ counter: JSON.stringify({ schemaVersion: 1, snapshot: { word: "three" } }) }), options);

		expect(unversioned.getState().count).toBe(4);
		expect(versionOne.getState().count).toBe(2);
		expect(unknownWord.getState().count).toBe(0);
	});

	it("rewrites a migrated snapshot in the current format straight away", () => {
		const storage = memoryStorage({ counter: JSON.stringify({ count: 4 }) });

		connectFeaturePersistence(store(), storage, options);

		expect(storage.entries.get("counter")).toBe(stored(COUNT_VERSION, { count: 4 }));
	});

	it("writes only when the persisted slice changes, and stops after disconnecting", () => {
		const counter = store();
		const storage = memoryStorage();
		const disconnect = connectFeaturePersistence(counter, storage, options);

		counter.dispatch({ type: "[ Counter ] Saved", value: 1 });
		expect(storage.entries.has("counter")).toBe(false);

		counter.dispatch({ type: "[ Counter ] Incremented", by: 4 });
		expect(storage.entries.get("counter")).toBe(stored(COUNT_VERSION, { count: 4 }));

		disconnect();
		counter.dispatch({ type: "[ Counter ] Incremented", by: 1 });
		expect(storage.entries.get("counter")).toBe(stored(COUNT_VERSION, { count: 4 }));
	});
});

describe("parseStoredJson", () => {
	it("returns the validated value, or null for text that is not JSON or fails the schema", () => {
		const schema = z.object({ count: z.number() });

		expect(parseStoredJson('{"count":3}', schema)).toEqual({ count: 3 });
		expect(parseStoredJson("list", schema)).toBeNull();
		expect(parseStoredJson('{"count":"3"}', schema)).toBeNull();
	});
});
