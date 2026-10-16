// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { listFilterKey, listUrlParams } from "./list-url-state";
import { defineUrlState, optionalUrlParam } from "./url-state";
import { useUrlState } from "./use-url-state";

// `useSearchParams` reads the address bar, as Next.js does once the History
// API integration has synced it.
vi.mock("next/navigation", () => ({
	useSearchParams: (): URLSearchParams => new URLSearchParams(window.location.search),
}));

const PATH = "/users";
const TABLE_URL_STATE = defineUrlState(
	{
		...listUrlParams({ sortable: ["name", "createdAt"], defaultSort: [{ field: "createdAt", direction: "desc" }] }, { pageSizes: [10, 20], defaultLimit: 20 }),
		status: optionalUrlParam(z.enum(["active", "locked"])),
	},
	{ urlKeys: { status: listFilterKey("status") } },
);

function setUrl(url: string): void {
	window.history.replaceState(null, "", url);
}

function currentUrl(): string {
	return `${window.location.pathname}${decodeURIComponent(window.location.search)}${window.location.hash}`;
}

beforeEach((): void => {
	setUrl(PATH);
});

afterEach((): void => {
	cleanup();
	vi.restoreAllMocks();
});

describe("useUrlState", () => {
	it("parses the current URL (invalid params fall back to defaults)", () => {
		setUrl(`${PATH}?page=3&sort=-name&filter[status]=nope`);
		const { result } = renderHook(() => useUrlState(TABLE_URL_STATE));
		expect(result.current[LIST_SLOT_INDEX.first]).toEqual({ ...TABLE_URL_STATE.defaults, page: 3, sort: "-name" });
	});

	it("pushes a history entry for a discrete change, omitting defaults", () => {
		const pushState = vi.spyOn(window.history, "pushState");
		const { result } = renderHook(() => useUrlState(TABLE_URL_STATE));
		act((): void => {
			result.current[LIST_SLOT_INDEX.second]({ status: "locked", page: 2 });
		});
		expect(pushState).toHaveBeenCalledTimes(1);
		expect(currentUrl()).toBe(`${PATH}?page=2&filter[status]=locked`);
	});

	it("replaces the current entry when asked (continuous input)", () => {
		const pushState = vi.spyOn(window.history, "pushState");
		const replaceState = vi.spyOn(window.history, "replaceState");
		const { result } = renderHook(() => useUrlState(TABLE_URL_STATE));
		act((): void => {
			result.current[LIST_SLOT_INDEX.second]({ sort: "name" }, { history: "replace" });
		});
		expect(pushState).not.toHaveBeenCalled();
		expect(replaceState).toHaveBeenCalledTimes(1);
		expect(currentUrl()).toBe(`${PATH}?sort=name`);
	});

	it("does not navigate when the patch changes nothing", () => {
		setUrl(`${PATH}?page=2`);
		const pushState = vi.spyOn(window.history, "pushState");
		const { result } = renderHook(() => useUrlState(TABLE_URL_STATE));
		act((): void => {
			result.current[LIST_SLOT_INDEX.second]({ page: 2 });
			result.current[LIST_SLOT_INDEX.second]({ limit: 20 });
		});
		expect(pushState).not.toHaveBeenCalled();
	});

	it("composes updates made in the same tick against the live URL", () => {
		const pushState = vi.spyOn(window.history, "pushState");
		setUrl(`${PATH}?page=4`);
		const { result } = renderHook(() => useUrlState(TABLE_URL_STATE));
		act((): void => {
			// A filter change resets to page 1, then the table asks for page 1 again.
			result.current[LIST_SLOT_INDEX.second]({ status: "active", page: 1, cursor: undefined });
			result.current[LIST_SLOT_INDEX.second]({ page: 1 });
		});
		expect(pushState).toHaveBeenCalledTimes(1);
		expect(currentUrl()).toBe(`${PATH}?filter[status]=active`);
	});

	it("keeps params it does not own and the hash", () => {
		setUrl(`${PATH}?tab=states#top`);
		const { result } = renderHook(() => useUrlState(TABLE_URL_STATE));
		act((): void => {
			result.current[LIST_SLOT_INDEX.second]({ page: 2 });
		});
		expect(currentUrl()).toBe(`${PATH}?tab=states&page=2#top`);
	});

	it("drops a param that returns to its default", () => {
		setUrl(`${PATH}?page=2&limit=10`);
		const { result } = renderHook(() => useUrlState(TABLE_URL_STATE));
		act((): void => {
			result.current[LIST_SLOT_INDEX.second]({ page: 1, limit: 20 });
		});
		expect(currentUrl()).toBe(PATH);
	});

	it("re-derives state when the URL changes (back/forward), with no copy to resync", () => {
		setUrl(`${PATH}?page=2`);
		const { result, rerender } = renderHook(() => useUrlState(TABLE_URL_STATE));
		expect(result.current[LIST_SLOT_INDEX.first].page).toBe(2);
		setUrl(`${PATH}?page=5&filter[status]=locked`);
		rerender();
		expect(result.current[LIST_SLOT_INDEX.first]).toEqual({ ...TABLE_URL_STATE.defaults, page: 5, status: "locked" });
	});

	it("returns a stable updater across renders", () => {
		const { result, rerender } = renderHook(() => useUrlState(TABLE_URL_STATE));
		const first = result.current[LIST_SLOT_INDEX.second];
		rerender();
		expect(result.current[LIST_SLOT_INDEX.second]).toBe(first);
	});
});
