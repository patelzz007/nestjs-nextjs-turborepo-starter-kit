// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyTheme } from "./theme";

const mermaidApi = vi.hoisted(() => ({
	initialize: vi.fn<(config: { readonly theme?: string }) => void>(),
	run: vi.fn<(options: { readonly nodes: readonly HTMLElement[] }) => Promise<void>>(),
}));

vi.mock("mermaid", () => ({ default: mermaidApi }));

describe("initMermaid", () => {
	beforeEach(() => {
		vi.resetModules();
		mermaidApi.initialize.mockReset();
		mermaidApi.run.mockReset();
		mermaidApi.run.mockResolvedValue(undefined);
		document.documentElement.dataset.theme = "light";
		document.body.innerHTML = `<div class="mermaid-diagram"><pre class="mermaid">graph TD; A--&gt;B</pre></div>`;
	});

	it("does not load mermaid on pages without diagrams", async () => {
		document.body.innerHTML = "";
		const { initMermaid } = await import("./mermaid");
		initMermaid();
		await Promise.resolve();
		expect(mermaidApi.run).not.toHaveBeenCalled();
	});

	it("renders diagrams with the light palette, then re-renders on theme change", async () => {
		// Mermaid 12 changed the default layout engine and look; both themes pin the classic dagre rendering.
		const classicRendering = { layout: "dagre", look: "classic" };
		const { initMermaid } = await import("./mermaid");
		initMermaid();
		await vi.waitFor(() => {
			expect(mermaidApi.run).toHaveBeenCalledTimes(1);
		});
		expect(mermaidApi.initialize).toHaveBeenLastCalledWith(expect.objectContaining({ theme: "base", securityLevel: "strict", ...classicRendering }));
		const block = document.querySelector<HTMLElement>("pre.mermaid");
		expect(block?.dataset.source).toBe("graph TD; A-->B");

		if (block !== null) {
			block.textContent = "<svg>rendered</svg>";
		}
		applyTheme("dark");
		await vi.waitFor(() => {
			expect(mermaidApi.run).toHaveBeenCalledTimes(2);
		});
		expect(mermaidApi.initialize).toHaveBeenLastCalledWith(expect.objectContaining({ theme: "dark", ...classicRendering }));
		expect(block?.textContent).toBe("graph TD; A-->B");
	});

	it("flags diagrams that fail to render", async () => {
		mermaidApi.run.mockRejectedValue(new Error("bad diagram"));
		const { initMermaid } = await import("./mermaid");
		initMermaid();
		await vi.waitFor(() => {
			expect(document.querySelector<HTMLElement>("pre.mermaid")?.dataset.error).toBe("true");
		});
	});
});
