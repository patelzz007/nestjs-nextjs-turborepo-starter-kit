// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { flushUrlUpdates } from "../../../testing/flush-url-updates";
import { defineUrlState, optionalUrlParam } from "../url-state";
import { UrlStateTestProvider, writeUrlUpdateToLocation } from "../url-state-test-provider";
import { useUrlState } from "../use-url-state";

const PATH = "/geography";
const TAB_URL_STATE = defineUrlState({ tab: optionalUrlParam(z.enum(["countries", "cities"])) });
const UPDATE_OPTIONS = { scroll: false, shallow: true, startTransition: undefined };

beforeEach((): void => {
	window.history.replaceState(null, "", `${PATH}#map`);
});

afterEach((): void => {
	cleanup();
	vi.restoreAllMocks();
});

describe("writeUrlUpdateToLocation", () => {
	it("pushes a push update, keeping the path and the hash", () => {
		const pushState = vi.spyOn(window.history, "pushState");
		writeUrlUpdateToLocation({ searchParams: new URLSearchParams("tab=cities"), queryString: "?tab=cities", options: { ...UPDATE_OPTIONS, history: "push" } });
		expect(pushState).toHaveBeenCalledTimes(1);
		expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(`${PATH}?tab=cities#map`);
	});

	it("replaces the entry for a replace update", () => {
		const pushState = vi.spyOn(window.history, "pushState");
		writeUrlUpdateToLocation({ searchParams: new URLSearchParams(), queryString: "", options: { ...UPDATE_OPTIONS, history: "replace" } });
		expect(pushState).not.toHaveBeenCalled();
		expect(window.location.search).toBe("");
	});
});

describe("UrlStateTestProvider", () => {
	it("starts from the address bar", () => {
		window.history.replaceState(null, "", `${PATH}?tab=cities`);
		const { result } = renderHook(() => useUrlState(TAB_URL_STATE), { wrapper: UrlStateTestProvider });
		expect(result.current[LIST_SLOT_INDEX.first].tab).toBe("cities");
	});

	it("follows Back to the entry before a pushed update", async () => {
		const { result } = renderHook(() => useUrlState(TAB_URL_STATE), { wrapper: UrlStateTestProvider });
		act((): void => {
			result.current[LIST_SLOT_INDEX.second]({ tab: "cities" });
		});
		await flushUrlUpdates();
		expect(window.location.search).toBe("?tab=cities");

		window.history.back();

		await waitFor((): void => {
			expect(result.current[LIST_SLOT_INDEX.first].tab).toBeUndefined();
		});
	});
});
