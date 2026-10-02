import { describe, expect, it } from "vitest";

import { prefetchedDataFor, toPrefetchedQuery, type PrefetchedQuery } from "./prefetched-query";

const ROWS: readonly string[] = ["a", "b"];

describe("toPrefetchedQuery", () => {
	it("binds a fulfilled prefetch to the URL state it was fetched for", () => {
		expect(toPrefetchedQuery("page=2", { status: "fulfilled", value: ROWS })).toEqual({ stateKey: "page=2", data: ROWS });
	});

	it("drops a failed prefetch so the client fetches on its own", () => {
		const failed: PromiseSettledResult<readonly string[]> = { status: "rejected", reason: new Error("network down") };
		expect(toPrefetchedQuery("page=2", failed)).toBeUndefined();
	});
});

describe("prefetchedDataFor", () => {
	const prefetched: PrefetchedQuery<readonly string[]> = { stateKey: "search=jane", data: ROWS };

	it("returns the data while the client renders the state the server fetched", () => {
		expect(prefetchedDataFor(prefetched, "search=jane")).toBe(ROWS);
	});

	it("returns nothing once the client state differs — another query key", () => {
		expect(prefetchedDataFor(prefetched, "search=jane&page=2")).toBeUndefined();
		expect(prefetchedDataFor(prefetched, "")).toBeUndefined();
	});

	it("returns nothing when the server did not prefetch", () => {
		expect(prefetchedDataFor(undefined, "")).toBeUndefined();
	});
});
