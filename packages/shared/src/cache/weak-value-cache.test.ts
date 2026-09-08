import { describe, expect, it } from "vitest";

import { WeakValueCache, finalizeWeakValueEntry } from "./weak-value-cache";

describe("WeakValueCache", () => {
	it("returns stored values while they are strongly reachable", () => {
		const cache = new WeakValueCache<string, { readonly id: string }>();
		const value = { id: "alpha" };
		cache.set("key", value);
		expect(cache.get("key")).toBe(value);
	});

	it("delete and clear unregister finalizers", () => {
		const cache = new WeakValueCache<string, { readonly id: string }>();
		const value = { id: "alpha" };
		cache.set("key", value);
		expect(cache.delete("key")).toBe(true);
		expect(cache.get("key")).toBeUndefined();

		cache.set("key", value);
		cache.clear();
		expect(cache.size).toBe(0);
	});

	it("finalizeWeakValueEntry ignores stale refs after overwrite", () => {
		const store = new Map<string, WeakRef<{ readonly id: string }>>();
		const first = { id: "first" };
		const second = { id: "second" };
		const firstRef = new WeakRef(first);
		const secondRef = new WeakRef(second);
		store.set("key", firstRef);
		store.set("key", secondRef);

		finalizeWeakValueEntry(store, { key: "key", ref: firstRef });
		expect(store.get("key")).toBe(secondRef);
		expect(secondRef.deref()).toBe(second);

		finalizeWeakValueEntry(store, { key: "key", ref: secondRef });
		expect(store.size).toBe(0);
	});
});
