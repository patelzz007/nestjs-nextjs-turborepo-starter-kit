// @vitest-environment jsdom
import { renderCodeBlockIsland } from "@workspace/docs-renderer/code-block/render";
import { codeBlockProps } from "@workspace/docs-renderer/markdown/code-block";
import type { MediaIslandPayload } from "@workspace/docs-renderer/media/props";
import { renderMediaIsland } from "@workspace/docs-renderer/media/render";
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { CODE_BLOCK_ISLANDS, hydrateIslands, MEDIA_ISLANDS, mountIslands, type MountedIsland } from "../islands";

const writeText = vi.fn<(text: string) => Promise<void>>();

/** Observers report nothing in jsdom (it has no layout); the column width is read from `clientWidth`. */
class NoopObserver {
	public observe(): void {
		return undefined;
	}
	public unobserve(): void {
		return undefined;
	}
	public disconnect(): void {
		return undefined;
	}
}

const CAROUSEL: MediaIslandPayload = {
	kind: "carousel",
	props: {
		images: [
			{ src: "/images/email/welcome.png", alt: "The welcome email" },
			{ src: "/images/email/verification.png", alt: "The verification email" },
		],
		ratio: 16 / 9,
	},
};

describe("islands", () => {
	beforeAll(() => {
		Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
		Object.defineProperty(window, "ResizeObserver", { configurable: true, value: NoopObserver });
		Object.defineProperty(window, "IntersectionObserver", { configurable: true, value: NoopObserver });
		Object.defineProperty(window, "matchMedia", {
			configurable: true,
			value: () => ({ matches: false, addEventListener: (): void => undefined, removeEventListener: (): void => undefined }),
		});
		// React's `act` environment flag, so state updates flush inside act().
		Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		document.body.innerHTML = "";
	});

	it("should hydrate a build-time code block without mismatches and make copy work", async () => {
		const props = await codeBlockProps("pnpm install\npnpm dev", "bash", 'title="Terminal"');
		document.body.innerHTML = `<article>${renderCodeBlockIsland(props)}</article>`;
		const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
		writeText.mockResolvedValue(undefined);

		let roots: readonly MountedIsland[] = [];
		await act(async () => {
			roots = await hydrateIslands(document.body);
		});
		expect(roots).toHaveLength(1);
		expect(errors).not.toHaveBeenCalled();

		const copy = document.querySelector<HTMLButtonElement>("[data-slot=code-block-copy]");
		await act(async () => {
			copy?.click();
			await Promise.resolve();
		});
		expect(writeText).toHaveBeenCalledWith("pnpm install\npnpm dev");
	});

	it("should hydrate a carousel embed into the live component", async () => {
		document.body.innerHTML = renderMediaIsland(CAROUSEL);
		let roots: readonly MountedIsland[] = [];
		await act(async () => {
			roots = await hydrateIslands(document.body, [MEDIA_ISLANDS]);
		});
		expect(roots).toHaveLength(1);
		expect(document.querySelector("[data-media-island-root]")?.getAttribute("data-hydrated")).toBe("true");
	});

	it("should skip containers that are already hydrated or have no payload, and load nothing for them", async () => {
		document.body.innerHTML = `<div><div data-code-block-root></div></div><div><div data-code-block-root data-hydrated="true"></div><script type="application/json" data-code-block-props>{}</script></div>`;
		const load = vi.spyOn(CODE_BLOCK_ISLANDS, "load");
		let roots: readonly MountedIsland[] = [];
		await act(async () => {
			roots = await hydrateIslands(document.body, [CODE_BLOCK_ISLANDS]);
		});
		expect(roots).toHaveLength(0);
		expect(load).not.toHaveBeenCalled();
	});

	it("should unmount every root on cleanup, once", async () => {
		const props = await codeBlockProps("echo hi", "bash", "");
		document.body.innerHTML = renderCodeBlockIsland(props);
		let cleanup = (): void => undefined;
		await act(async () => {
			cleanup = mountIslands(document.body);
			await vi.waitFor(() => {
				expect(document.querySelector("[data-code-block-root]")?.getAttribute("data-hydrated")).toBe("true");
			});
		});
		await act(async () => {
			cleanup();
			cleanup();
			await Promise.resolve();
		});
		expect(document.querySelector("[data-code-block-root]")?.childElementCount).toBe(0);
	});

	it("should keep the markup and report when an island cannot be hydrated", async () => {
		document.body.innerHTML = `<div><div data-code-block-root></div><script type="application/json" data-code-block-props>not json</script></div>`;
		const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
		await act(async () => {
			mountIslands(document.body);
			await vi.waitFor(() => {
				expect(errors).toHaveBeenCalledWith("[docs] islands could not be hydrated", expect.anything());
			});
		});
	});

	it("should mount nothing when cleaned up before the islands load, so a second mount owns them (React runs effects twice in development)", async () => {
		const props = await codeBlockProps("echo twice", "bash", "");
		document.body.innerHTML = renderCodeBlockIsland(props);
		const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
		await act(async () => {
			const first = mountIslands(document.body);
			first();
			mountIslands(document.body);
			await vi.waitFor(() => {
				expect(document.querySelector("[data-code-block-root]")?.getAttribute("data-hydrated")).toBe("true");
			});
		});
		expect(document.querySelector("[data-slot=code-block]")).not.toBeNull();
		expect(errors).not.toHaveBeenCalled();
	});

	it("should render an island fresh when its container was emptied by an earlier unmount", async () => {
		const props = await codeBlockProps("echo again", "bash", "");
		document.body.innerHTML = renderCodeBlockIsland(props);
		let cleanup = (): void => undefined;
		await act(async () => {
			cleanup = mountIslands(document.body);
			await vi.waitFor(() => {
				expect(document.querySelector("[data-code-block-root]")?.getAttribute("data-hydrated")).toBe("true");
			});
		});
		await act(async () => {
			cleanup();
			await Promise.resolve();
		});
		expect(document.querySelector("[data-code-block-root]")?.hasAttribute("data-hydrated")).toBe(false);
		let again: readonly MountedIsland[] = [];
		await act(async () => {
			again = await hydrateIslands(document.body, [CODE_BLOCK_ISLANDS]);
		});
		expect(again).toHaveLength(1);
		expect(document.querySelector("[data-slot=code-block]")).not.toBeNull();
	});
});
