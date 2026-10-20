import { describe, expect, it } from "vitest";

import { deterministicUuid, SEED_ROW_ID_EPOCH_MS } from "../deterministic-uuid";

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("deterministicUuid", () => {
	it("is a UUID v7, like every id the app mints", () => {
		expect(deterministicUuid("seed", "row-1")).toMatch(UUID_V7);
	});

	it("gives the same row the same id on every re-seed", () => {
		expect(deterministicUuid("seed", "row-1")).toBe(deterministicUuid("seed", "row-1"));
	});

	it("separates keys and namespaces", () => {
		const ids = new Set([deterministicUuid("seed", "row-1"), deterministicUuid("seed", "row-2"), deterministicUuid("other", "row-1")]);

		expect(ids.size).toBe(3);
	});

	it("carries the fixed seed creation time", () => {
		const id = deterministicUuid("seed", "row-1");

		expect(Number.parseInt(id.replaceAll("-", "").slice(0, 12), 16)).toBe(SEED_ROW_ID_EPOCH_MS);
	});
});
