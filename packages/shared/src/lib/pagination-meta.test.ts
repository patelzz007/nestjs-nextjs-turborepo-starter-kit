import { describe, expect, it } from "vitest";

import { ApiPaginatedMetaSchema } from "../schemas/api/api-response";

import { stubPaginatedMeta, stubPaginatedMetaFromHydration } from "./pagination-meta";

describe("stubPaginatedMeta", () => {
	it("always satisfies ApiPaginatedMetaSchema", () => {
		const meta = stubPaginatedMeta(20, 156, 2, 8, true, "cursor-2", true);
		expect(ApiPaginatedMetaSchema.safeParse(meta).success).toBe(true);
	});
});

describe("stubPaginatedMetaFromHydration", () => {
	it("builds a valid first-page stub when more rows exist", () => {
		const meta = stubPaginatedMetaFromHydration(20, 20, true);
		expect(ApiPaginatedMetaSchema.safeParse(meta).success).toBe(true);
		expect(meta.page).toBe(1);
		expect(meta.hasNext).toBe(true);
	});

	it("builds a valid stub for an empty terminal page", () => {
		const meta = stubPaginatedMetaFromHydration(20, 0, false);
		expect(ApiPaginatedMetaSchema.safeParse(meta).success).toBe(true);
		expect(meta.total).toBe(0);
		expect(meta.hasNext).toBe(false);
	});
});
