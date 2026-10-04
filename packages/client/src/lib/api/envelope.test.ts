import { epochMs, type ApiPaginatedMeta, type ApiResponseMeta, type Envelope } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import {
	initialDataOption,
	readPaginatedHasNext,
	readPaginatedHasPrevious,
	readPaginatedNextCursor,
	readPaginatedPage,
	readPaginatedTotal,
	readPaginatedTotalPages,
} from "./envelope";

const ANSWERED_AT = epochMs(1_790_812_800_000);
const META: ApiResponseMeta = { correlationId: "corr-1", timestamp: ANSWERED_AT };
const PAGINATED_META: ApiPaginatedMeta = { ...META, limit: 10, total: 25, page: 2, totalPages: 3, nextCursor: "cursor-3", hasNext: true, hasPrevious: true };

describe("initialDataOption", () => {
	it("omits every key when nothing was prefetched", () => {
		const option = initialDataOption<Envelope<string>>(undefined);

		expect(option).toEqual({});
		expect(Object.hasOwn(option, "initialData")).toBe(false);
		expect(Object.hasOwn(option, "initialDataUpdatedAt")).toBe(false);
	});

	it("seeds the real envelope, dated by the server's answer time (not 'now')", () => {
		const envelope: Envelope<{ readonly id: string }> = { success: true, data: { id: "a" }, meta: META };

		expect(initialDataOption(envelope)).toEqual({ initialData: envelope, initialDataUpdatedAt: ANSWERED_AT });
	});
});

describe("paginated meta readers", () => {
	it("use the fallback only while there is no answer yet", () => {
		expect(readPaginatedTotal(undefined, 7)).toBe(7);
		expect(readPaginatedPage(undefined)).toBe(1);
		expect(readPaginatedTotalPages(undefined)).toBe(1);
		expect(readPaginatedHasNext(undefined, true)).toBe(true);
		expect(readPaginatedHasPrevious(undefined)).toBe(false);
		expect(readPaginatedNextCursor(undefined)).toBeNull();
	});

	it("read the server's pagination", () => {
		expect(readPaginatedTotal(PAGINATED_META)).toBe(25);
		expect(readPaginatedPage(PAGINATED_META)).toBe(2);
		expect(readPaginatedTotalPages(PAGINATED_META)).toBe(3);
		expect(readPaginatedHasNext(PAGINATED_META)).toBe(true);
		expect(readPaginatedHasPrevious(PAGINATED_META)).toBe(true);
		expect(readPaginatedNextCursor(PAGINATED_META)).toBe("cursor-3");
	});

	it("throw on a meta without pagination instead of hiding the drift behind a default", () => {
		expect(() => readPaginatedTotal(META)).toThrow();
		expect(() => readPaginatedNextCursor(META)).toThrow();
	});
});
