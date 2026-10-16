import { describe, expect, it } from "vitest";

import { buildOffsetPaginationMeta } from "./pagination-meta";

describe("buildOffsetPaginationMeta", () => {
	it("derives pages from the total and clamps the page into range", () => {
		expect(buildOffsetPaginationMeta(156, 2, 20)).toEqual({ total: 156, page: 2, limit: 20, totalPages: 8, hasNext: true, hasPrevious: true });
		expect(buildOffsetPaginationMeta(0, 5, 20)).toEqual({ total: 0, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrevious: false });
	});
});
