import { afterEach, describe, expect, it, vi } from "vitest";
import { WeakValueCache, finalizeWeakValueEntry } from "@workspace/shared";

import { getCachedHighlighterForTests, getSharedHighlighter, resetSharedHighlighterForTests, type ShikiHighlighterConfig } from "@/components/docs/highlighter-cache";

const TEST_CONFIG: ShikiHighlighterConfig = {
	theme: "one-dark-pro",
	langs: ["typescript"],
};

const createHighlighterMock = vi.fn<(config: ShikiHighlighterConfig) => Promise<{ codeToHtml: (code: string) => string }>>();

vi.mock("shiki", () => ({
	createHighlighter: (config: ShikiHighlighterConfig): Promise<{ codeToHtml: (code: string) => string }> => createHighlighterMock(config),
}));

describe("highlighter-cache", () => {
	afterEach((): void => {
		resetSharedHighlighterForTests();
		createHighlighterMock.mockReset();
	});

	it("deduplicates concurrent loads into one createHighlighter call", async (): Promise<void> => {
		const highlighter = { codeToHtml: (code: string): string => code };
		createHighlighterMock.mockImplementation(
			(): Promise<{ codeToHtml: (code: string) => string }> =>
				new Promise((resolve) => {
					setTimeout((): void => {
						resolve(highlighter);
					}, 10);
				}),
		);

		const [first, second] = await Promise.all([getSharedHighlighter(TEST_CONFIG), getSharedHighlighter(TEST_CONFIG)]);
		expect(first).toBe(highlighter);
		expect(second).toBe(highlighter);
		expect(createHighlighterMock).toHaveBeenCalledTimes(1);
	});

	it("reuses a cached highlighter without calling createHighlighter again", async (): Promise<void> => {
		const highlighter = { codeToHtml: (code: string): string => code };
		createHighlighterMock.mockResolvedValue(highlighter);

		await getSharedHighlighter(TEST_CONFIG);
		createHighlighterMock.mockClear();

		const cached = await getSharedHighlighter(TEST_CONFIG);
		expect(cached).toBe(highlighter);
		expect(createHighlighterMock).not.toHaveBeenCalled();
	});

	it("reloads after the weak cache entry is collected", async (): Promise<void> => {
		const first = { codeToHtml: (code: string): string => `first:${code}` };
		const second = { codeToHtml: (code: string): string => `second:${code}` };
		createHighlighterMock.mockResolvedValueOnce(first).mockResolvedValueOnce(second);

		await getSharedHighlighter(TEST_CONFIG);
		expect(getCachedHighlighterForTests()).toBe(first);

		resetSharedHighlighterForTests();
		const reloaded = await getSharedHighlighter(TEST_CONFIG);
		expect(reloaded).toBe(second);
		expect(createHighlighterMock).toHaveBeenCalledTimes(2);
	});

	it("does not let a stale finalizer remove a replacement highlighter", (): void => {
		const cache = new WeakValueCache<string, { readonly id: string }>();
		const first = { id: "first" };
		const second = { id: "second" };
		const firstRef = new WeakRef(first);

		cache.set("default", first);
		cache.set("default", second);
		finalizeWeakValueEntry(new Map([["default", firstRef]]), { key: "default", ref: firstRef });

		expect(cache.get("default")).toBe(second);
	});

	it("retries after createHighlighter fails", async (): Promise<void> => {
		const highlighter = { codeToHtml: (code: string): string => code };
		createHighlighterMock.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(highlighter);

		await expect(getSharedHighlighter(TEST_CONFIG)).rejects.toThrow("network");
		const recovered = await getSharedHighlighter(TEST_CONFIG);
		expect(recovered).toBe(highlighter);
		expect(createHighlighterMock).toHaveBeenCalledTimes(2);
	});
});
