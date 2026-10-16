// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initMediaIslands } from "../media-islands";

describe("initMediaIslands", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("never loads React on pages without a media island", () => {
		const load = vi.fn<() => Promise<{ hydrateMediaIslands: () => number }>>();
		initMediaIslands(load);
		expect(load).not.toHaveBeenCalled();
	});

	it("loads the hydrator once and hydrates when islands exist", async () => {
		document.body.innerHTML = `<div data-media-island-root></div>`;
		const hydrateMediaIslands = vi.fn<() => number>(() => 1);
		const load = vi.fn<() => Promise<{ hydrateMediaIslands: () => number }>>(() => Promise.resolve({ hydrateMediaIslands }));
		initMediaIslands(load);
		await vi.waitFor(() => {
			expect(hydrateMediaIslands).toHaveBeenCalledTimes(1);
		});
		expect(load).toHaveBeenCalledTimes(1);
	});

	it("logs, and leaves the static images in place, when loading fails", async () => {
		document.body.innerHTML = `<div data-media-island-root><img alt="Still here" src="/a.png"></div>`;
		const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
		initMediaIslands(() => Promise.reject(new Error("offline")));
		await vi.waitFor(() => {
			expect(error).toHaveBeenCalledTimes(1);
		});
		expect(document.querySelector("img")?.alt).toBe("Still here");
	});
});
