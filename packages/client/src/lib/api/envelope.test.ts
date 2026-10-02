import { describe, expect, it } from "vitest";

import {
	initialDataOption,
	readPaginatedHasNext,
	readPaginatedHasPrevious,
	readPaginatedNextCursor,
	readPaginatedPage,
	readPaginatedTotal,
	readPaginatedTotalPages,
	stubApiMeta,
	stubPaginatedMetaFromHydration,
	successEnvelope,
} from "./envelope";

describe("initialDataOption", () => {
	it("omits the initialData key entirely when nothing was prefetched", () => {
		const option = initialDataOption<string>(undefined);

		expect(option).toEqual({});
		expect(Object.hasOwn(option, "initialData")).toBe(false);
	});

	it("carries prefetched data under initialData", () => {
		const envelope = successEnvelope({ id: "a" }, stubApiMeta());

		expect(initialDataOption(envelope)).toEqual({ initialData: envelope });
	});

	it("keeps falsy-but-defined data such as an empty list or zero", () => {
		const envelope = successEnvelope([], stubApiMeta());

		expect(initialDataOption(envelope)).toEqual({ initialData: envelope });
		expect(initialDataOption(0)).toEqual({ initialData: 0 });
	});
});

describe("successEnvelope / stubApiMeta", () => {
	it("wraps data and meta in a success envelope", () => {
		const meta = stubApiMeta();

		expect(successEnvelope({ id: "a" }, meta)).toEqual({ success: true, data: { id: "a" }, meta });
		expect(meta.correlationId).toBe("");
	});
});

describe("pagination readers", () => {
	it("fall back when meta is absent", () => {
		expect(readPaginatedTotal(undefined, 7)).toBe(7);
		expect(readPaginatedPage(undefined)).toBe(1);
		expect(readPaginatedTotalPages(undefined)).toBe(1);
		expect(readPaginatedHasNext(undefined, true)).toBe(true);
		expect(readPaginatedHasPrevious(undefined)).toBe(false);
		expect(readPaginatedNextCursor(undefined)).toBeNull();
	});

	it("fall back when meta is not paginated", () => {
		const meta = stubApiMeta();

		expect(readPaginatedTotal(meta)).toBe(0);
		expect(readPaginatedHasNext(meta)).toBe(false);
		expect(readPaginatedNextCursor(meta)).toBeNull();
	});

	it("read values from paginated meta", () => {
		const meta = stubPaginatedMetaFromHydration(10, 10, true, "cursor-2");

		expect(readPaginatedHasNext(meta)).toBe(true);
		expect(readPaginatedNextCursor(meta)).toBe("cursor-2");
		expect(readPaginatedTotal(meta)).toBe(meta.total);
		expect(readPaginatedPage(meta)).toBe(meta.page);
	});
});
