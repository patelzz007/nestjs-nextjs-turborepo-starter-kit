// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { listFilterKey, listUrlParams } from "../list-url-state";
import { defineUrlState, optionalUrlParam } from "../url-state";
import { UrlStateTestProvider } from "../url-state-test-provider";
import { rawUrlParamsFromSearch, useUrlState } from "../use-url-state";

const PATH = "/users";
/** Longer than nuqs's URL-write throttle (50 ms), so a write that was going to happen has happened. */
const URL_WRITE_SETTLE_MS = 120;
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

/** A stand-in for `window.navigation` (jsdom has no Navigation API). */
function installNavigation(): EventTarget {
	const navigation = new EventTarget();
	Object.defineProperty(window, "navigation", { value: navigation, configurable: true });
	return navigation;
}

/** A Back / Forward as the Navigation API reports it. */
function traverseEvent(): Event {
	const event = new Event("currententrychange");
	Object.defineProperty(event, "navigationType", { value: "traverse" });
	return event;
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
	Reflect.deleteProperty(window, "navigation");
});

describe("useUrlState", () => {
	it("parses the current URL (invalid params fall back to defaults)", () => {
		setUrl(`${PATH}?page=3&sort=-name&filter[status]=nope`);
		const { result } = renderHook(() => useUrlState(TABLE_URL_STATE), { wrapper: UrlStateTestProvider });
		expect(result.current[LIST_SLOT_INDEX.first]).toEqual({ ...TABLE_URL_STATE.defaults, page: 3, sort: "-name" });
	});

	it("pushes a history entry for a discrete change, omitting defaults", async () => {
		const pushState = vi.spyOn(window.history, "pushState");
		const { result } = renderHook(() => useUrlState(TABLE_URL_STATE), { wrapper: UrlStateTestProvider });
		act((): void => {
			result.current[LIST_SLOT_INDEX.second]({ status: "locked", page: 2 });
		});
		await waitFor((): void => {
			expect(currentUrl()).toBe(`${PATH}?page=2&filter[status]=locked`);
		});
		expect(pushState).toHaveBeenCalledTimes(1);
	});

	it("replaces the current entry when asked (continuous input)", async () => {
		const pushState = vi.spyOn(window.history, "pushState");
		const replaceState = vi.spyOn(window.history, "replaceState");
		const { result } = renderHook(() => useUrlState(TABLE_URL_STATE), { wrapper: UrlStateTestProvider });
		act((): void => {
			result.current[LIST_SLOT_INDEX.second]({ sort: "name" }, { history: "replace" });
		});
		await waitFor((): void => {
			expect(currentUrl()).toBe(`${PATH}?sort=name`);
		});
		expect(pushState).not.toHaveBeenCalled();
		expect(replaceState).toHaveBeenCalledTimes(1);
	});

	it("does not navigate when the patch changes nothing", async () => {
		setUrl(`${PATH}?page=2`);
		const pushState = vi.spyOn(window.history, "pushState");
		const { result } = renderHook(() => useUrlState(TABLE_URL_STATE), { wrapper: UrlStateTestProvider });
		act((): void => {
			result.current[LIST_SLOT_INDEX.second]({ page: 2 });
			result.current[LIST_SLOT_INDEX.second]({ limit: 20 });
		});
		await new Promise<void>((resolve: () => void): void => {
			setTimeout(resolve, 0);
		});
		expect(pushState).not.toHaveBeenCalled();
	});

	it("composes updates made in the same tick, written as one history entry", async () => {
		const pushState = vi.spyOn(window.history, "pushState");
		setUrl(`${PATH}?page=4`);
		const { result } = renderHook(() => useUrlState(TABLE_URL_STATE), { wrapper: UrlStateTestProvider });
		act((): void => {
			// A filter change resets to page 1, then the table asks for page 1 again.
			result.current[LIST_SLOT_INDEX.second]({ status: "active", page: 1, cursor: undefined });
			result.current[LIST_SLOT_INDEX.second]({ page: 1 });
		});
		await waitFor((): void => {
			expect(currentUrl()).toBe(`${PATH}?filter[status]=active`);
		});
		expect(pushState).toHaveBeenCalledTimes(1);
	});

	it("keeps params it does not own and the hash", async () => {
		setUrl(`${PATH}?tab=states#top`);
		const { result } = renderHook(() => useUrlState(TABLE_URL_STATE), { wrapper: UrlStateTestProvider });
		act((): void => {
			result.current[LIST_SLOT_INDEX.second]({ page: 2 });
		});
		await waitFor((): void => {
			expect(currentUrl()).toBe(`${PATH}?tab=states&page=2#top`);
		});
	});

	it("drops a param that returns to its default", async () => {
		setUrl(`${PATH}?page=2&limit=10`);
		const { result } = renderHook(() => useUrlState(TABLE_URL_STATE), { wrapper: UrlStateTestProvider });
		act((): void => {
			result.current[LIST_SLOT_INDEX.second]({ page: 1, limit: 20 });
		});
		await waitFor((): void => {
			expect(currentUrl()).toBe(PATH);
		});
	});

	it("changes the state in the same render as the update, before the URL is written", () => {
		const { result } = renderHook(() => useUrlState(TABLE_URL_STATE), { wrapper: UrlStateTestProvider });
		act((): void => {
			result.current[LIST_SLOT_INDEX.second]({ status: "locked" });
		});
		expect(result.current[LIST_SLOT_INDEX.first].status).toBe("locked");
		expect(window.location.search).toBe("");
	});

	it("shares one state between every hook reading the same codec", () => {
		const { result } = renderHook(() => ({ writer: useUrlState(TABLE_URL_STATE), reader: useUrlState(TABLE_URL_STATE) }), { wrapper: UrlStateTestProvider });
		act((): void => {
			result.current.writer[LIST_SLOT_INDEX.second]({ page: 3 });
		});
		expect(result.current.reader[LIST_SLOT_INDEX.first].page).toBe(3);
	});

	it("re-derives state when the URL changes (back/forward), with no copy to resync", () => {
		setUrl(`${PATH}?page=2`);
		const { result, rerender } = renderHook(() => useUrlState(TABLE_URL_STATE), { wrapper: UrlStateTestProvider });
		expect(result.current[LIST_SLOT_INDEX.first].page).toBe(2);
		setUrl(`${PATH}?page=5&filter[status]=locked`);
		rerender();
		expect(result.current[LIST_SLOT_INDEX.first]).toEqual({ ...TABLE_URL_STATE.defaults, page: 5, status: "locked" });
	});

	it("follows the address bar after a Back the router never reported, on the same history entry", async () => {
		const navigation = installNavigation();
		const { result } = renderHook(() => useUrlState(TABLE_URL_STATE), { wrapper: UrlStateTestProvider });
		act((): void => {
			result.current[LIST_SLOT_INDEX.second]({ page: 2 });
		});
		await waitFor((): void => {
			expect(currentUrl()).toBe(`${PATH}?page=2`);
		});
		const pushState = vi.spyOn(window.history, "pushState");

		// The Back lands before the router rendered `?page=2`: the address bar changes, the router value does not.
		setUrl(PATH);
		act((): void => {
			navigation.dispatchEvent(traverseEvent());
		});

		await waitFor((): void => {
			expect(result.current[LIST_SLOT_INDEX.first].page).toBe(1);
		});
		expect(currentUrl()).toBe(PATH);
		expect(pushState).not.toHaveBeenCalled();
	});

	it("writes nothing after a Back the state already follows", async () => {
		const navigation = installNavigation();
		setUrl(`${PATH}?page=2`);
		renderHook(() => useUrlState(TABLE_URL_STATE), { wrapper: UrlStateTestProvider });
		const replaceState = vi.spyOn(window.history, "replaceState");
		act((): void => {
			navigation.dispatchEvent(traverseEvent());
		});
		await new Promise<void>((resolve: () => void): void => {
			setTimeout(resolve, URL_WRITE_SETTLE_MS);
		});
		expect(replaceState).not.toHaveBeenCalled();
	});

	it("returns a stable updater across renders", () => {
		const { result, rerender } = renderHook(() => useUrlState(TABLE_URL_STATE), { wrapper: UrlStateTestProvider });
		const first = result.current[LIST_SLOT_INDEX.second];
		rerender();
		expect(result.current[LIST_SLOT_INDEX.second]).toBe(first);
	});
});

// The raw-param conversions shared with the mobile app are tested where they live (@workspace/shared, lib/url-state).
describe("raw URL params", () => {
	it("reads the given keys from a search string, null when absent", () => {
		expect(rawUrlParamsFromSearch(["page", "sort"], "?page=3&other=x")).toEqual({ page: "3", sort: null });
	});
});
