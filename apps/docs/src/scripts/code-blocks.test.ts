// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initCodeBlocks } from "./code-blocks";

describe("initCodeBlocks", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("never loads React on pages without code blocks", () => {
		const load = vi.fn<() => Promise<{ hydrateCodeBlocks: () => number }>>();
		initCodeBlocks(load);
		expect(load).not.toHaveBeenCalled();
	});

	it("loads the hydrator once and hydrates when blocks exist", async () => {
		document.body.innerHTML = `<div data-code-block-root></div>`;
		const hydrateCodeBlocks = vi.fn<() => number>(() => 1);
		const load = vi.fn<() => Promise<{ hydrateCodeBlocks: () => number }>>(() => Promise.resolve({ hydrateCodeBlocks }));
		initCodeBlocks(load);
		await vi.waitFor(() => {
			expect(hydrateCodeBlocks).toHaveBeenCalledTimes(1);
		});
		expect(load).toHaveBeenCalledTimes(1);
	});

	it("logs, and leaves the static blocks in place, when loading fails", async () => {
		document.body.innerHTML = `<div data-code-block-root><pre>code</pre></div>`;
		const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
		initCodeBlocks(() => Promise.reject(new Error("offline")));
		await vi.waitFor(() => {
			expect(error).toHaveBeenCalledTimes(1);
		});
		expect(document.querySelector("pre")?.textContent).toBe("code");
	});
});
