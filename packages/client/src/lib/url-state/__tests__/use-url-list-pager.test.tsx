// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { epochMs, type ApiPaginatedMeta } from "@workspace/shared";
import { describe, expect, it, vi } from "vitest";

import type { ListUrlPagePatch, ListUrlPagingState } from "../list-url-state";
import { useUrlListPager } from "../use-url-list-pager";

const BASE_META = { correlationId: "corr-1", timestamp: epochMs(1_792_368_000_000) };

function metaOf(page: number, totalPages: number, nextCursor: string | null): ApiPaginatedMeta {
	return { ...BASE_META, limit: 20, total: totalPages * 20, page, totalPages, nextCursor, hasNext: page < totalPages, hasPrevious: page > 1 };
}

function state(page: number, sort?: string): ListUrlPagingState {
	return { page, limit: 20, cursor: undefined, sort };
}

describe("useUrlListPager", () => {
	it("reads the position from meta and follows the keyset cursor forward", () => {
		const update = vi.fn<(patch: ListUrlPagePatch) => void>();
		const { result } = renderHook(() => useUrlListPager(state(1), update, metaOf(1, 3, "cursor-2")));

		expect(result.current).toMatchObject({ page: 1, totalPages: 3, hasPrevious: false, hasNext: true, isPaged: true });
		act(() => {
			result.current.onNext();
		});
		expect(update).toHaveBeenLastCalledWith({ page: 2, cursor: "cursor-2" });
	});

	it("pages back and to the first page by offset, and forward by offset under a custom sort", () => {
		const update = vi.fn<(patch: ListUrlPagePatch) => void>();
		const { result } = renderHook(() => useUrlListPager(state(3, "name"), update, metaOf(3, 5, "cursor-4")));

		act(() => {
			result.current.onPrevious();
		});
		expect(update).toHaveBeenLastCalledWith({ page: 2, cursor: undefined });
		act(() => {
			result.current.onFirstPage();
		});
		expect(update).toHaveBeenLastCalledWith({ page: 1, cursor: undefined });
		act(() => {
			result.current.onNext();
		});
		expect(update).toHaveBeenLastCalledWith({ page: 4, cursor: undefined });
	});

	it("is not paged when one page holds the whole list, and falls back to the current page without an answer", () => {
		expect(renderHook(() => useUrlListPager(state(1), vi.fn(), metaOf(1, 1, null))).result.current.isPaged).toBe(false);
		expect(renderHook(() => useUrlListPager(state(2), vi.fn(), undefined)).result.current).toMatchObject({ totalPages: 2, hasNext: false, hasPrevious: true });
	});
});
