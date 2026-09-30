// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { renderCodeBlockIsland } from "@/lib/code-block/render";
import { codeBlockProps } from "@/lib/markdown/code-block";

import { hydrateCodeBlocks } from "./code-block-hydrate";

const writeText = vi.fn<(text: string) => Promise<void>>();

describe("hydrateCodeBlocks", () => {
	beforeAll(() => {
		Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
		// React's `act` environment flag, so state updates flush inside act().
		Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		document.body.innerHTML = "";
	});

	it("hydrates the build-time markup without mismatches and makes copy work", async () => {
		const props = await codeBlockProps("pnpm install\npnpm dev", "bash", 'title="Terminal"');
		document.body.innerHTML = renderCodeBlockIsland(props);
		const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
		writeText.mockResolvedValue(undefined);

		let count = 0;
		await act(async () => {
			count = hydrateCodeBlocks();
			await Promise.resolve();
		});
		expect(count).toBe(1);
		expect(errors).not.toHaveBeenCalled();

		const copy = document.querySelector<HTMLButtonElement>("[data-slot=code-block-copy]");
		await act(async () => {
			copy?.click();
			await Promise.resolve();
		});
		expect(writeText).toHaveBeenCalledWith("pnpm install\npnpm dev");
		expect(copy?.hasAttribute("data-copied")).toBe(true);
	});

	it("skips containers that are already hydrated or have no payload", async () => {
		document.body.innerHTML = `<div><div data-code-block-root></div></div>`;
		let count = -1;
		await act(async () => {
			count = hydrateCodeBlocks();
			await Promise.resolve();
		});
		expect(count).toBe(0);
	});
});
