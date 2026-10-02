import { describe, expect, it } from "vitest";

import { prefetchForLocation, type LocationScopedPrefetch } from "@/lib/org/location-prefetch";
import { STORE_A, STORE_B } from "@/test/terminals";

const ROWS: readonly string[] = ["first", "second"];

describe("prefetchForLocation", () => {
	it("returns the data when it was fetched for the filter the client queries", () => {
		const forStoreA: LocationScopedPrefetch<readonly string[]> = { locationId: STORE_A.id, data: ROWS };
		const forAllStores: LocationScopedPrefetch<readonly string[]> = { locationId: undefined, data: ROWS };

		expect(prefetchForLocation(forStoreA, STORE_A.id)).toBe(ROWS);
		expect(prefetchForLocation(forAllStores, undefined)).toBe(ROWS);
	});

	it("withholds data fetched for another filter, so it is never cached under the wrong key", () => {
		expect(prefetchForLocation({ locationId: STORE_A.id, data: ROWS }, STORE_B.id)).toBeUndefined();
		expect(prefetchForLocation({ locationId: STORE_A.id, data: ROWS }, undefined)).toBeUndefined();
		expect(prefetchForLocation({ locationId: undefined, data: ROWS }, STORE_A.id)).toBeUndefined();
	});

	it("has nothing to offer when the server prefetch failed", () => {
		expect(prefetchForLocation(undefined, STORE_A.id)).toBeUndefined();
	});
});
