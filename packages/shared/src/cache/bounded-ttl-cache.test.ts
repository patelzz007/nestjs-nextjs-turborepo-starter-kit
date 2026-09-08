import { describe, expect, it } from "vitest";

import { BoundedTtlCache } from "./bounded-ttl-cache";

describe("BoundedTtlCache", () => {
	it("returns null on miss and stores values until TTL expiry", () => {
		const cache = new BoundedTtlCache<string, string>({ maxEntries: 10, defaultTtlMs: 1000 });
		expect(cache.get("a")).toBeNull();

		expect(cache.set("a", "alpha", 500, 0)).toBe(true);
		expect(cache.get("a", 100)).toBe("alpha");
		expect(cache.get("a", 501)).toBeNull();
	});

	it("refreshes TTL and insertion order on overwrite", () => {
		const cache = new BoundedTtlCache<string, string>({ maxEntries: 2, defaultTtlMs: 1000 });

		expect(cache.set("a", "1", 1000, 0)).toBe(true);
		expect(cache.set("b", "2", 1000, 0)).toBe(true);
		expect(cache.set("a", "1-updated", 1000, 0)).toBe(true);

		expect(cache.set("c", "3", 1000, 0)).toBe(true);
		expect(cache.get("a", 0)).toBe("1-updated");
		expect(cache.get("b", 0)).toBeNull();
		expect(cache.get("c", 0)).toBe("3");
	});

	it("evicts the oldest entry when at capacity", () => {
		const cache = new BoundedTtlCache<string, number>({ maxEntries: 2, defaultTtlMs: 10_000 });

		expect(cache.set("first", 1, 10_000, 0)).toBe(true);
		expect(cache.set("second", 2, 10_000, 0)).toBe(true);
		expect(cache.set("third", 3, 10_000, 0)).toBe(true);

		expect(cache.get("first", 0)).toBeNull();
		expect(cache.get("second", 0)).toBe(2);
		expect(cache.get("third", 0)).toBe(3);
	});

	it("rejects new keys when capacity policy is reject-new", () => {
		const cache = new BoundedTtlCache<string, string>({
			maxEntries: 1,
			defaultTtlMs: 10_000,
			capacityPolicy: "reject-new",
		});

		expect(cache.set("a", "alpha", 10_000, 0)).toBe(true);
		expect(cache.set("b", "beta", 10_000, 0)).toBe(false);
		expect(cache.get("a", 0)).toBe("alpha");
		expect(cache.get("b", 0)).toBeNull();
	});

	it("sweeps expired entries and reports diagnostics", () => {
		const cache = new BoundedTtlCache<string, string>({ maxEntries: 5, defaultTtlMs: 1000 });

		cache.set("a", "alpha", 100, 0);
		cache.set("b", "beta", 1000, 0);

		expect(cache.sweepExpired(200)).toBe(1);
		expect(cache.getDiagnostics(200)).toEqual({
			entries: 1,
			expiredEntries: 0,
			maxEntries: 5,
			capacityPolicy: "evict-oldest",
		});
	});

	it("deleteMany removes multiple keys", () => {
		const cache = new BoundedTtlCache<string, string>({ maxEntries: 5, defaultTtlMs: 1000 });
		cache.set("a", "1", 1000, 0);
		cache.set("b", "2", 1000, 0);
		cache.set("c", "3", 1000, 0);

		expect(cache.deleteMany(["a", "c", "missing"])).toBe(2);
		expect(cache.size).toBe(1);
		expect(cache.get("b", 0)).toBe("2");
	});

	it("clear removes every entry", () => {
		const cache = new BoundedTtlCache<string, string>({ maxEntries: 5, defaultTtlMs: 1000 });
		cache.set("a", "1", 1000, 0);
		cache.clear();
		expect(cache.size).toBe(0);
	});
});
