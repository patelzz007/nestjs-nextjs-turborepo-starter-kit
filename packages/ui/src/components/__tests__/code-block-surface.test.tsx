import type * as React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CodeBlock } from "@workspace/ui/components/code-block";
import { isDarkCodeSurface } from "@workspace/ui/components/code-block-highlight";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";

describe("code block surface", () => {
	it("treats One Dark Pro (the default) as a dark surface, and a light theme as a light one", () => {
		expect(isDarkCodeSurface({ light: "one-dark-pro", dark: "one-dark-pro" })).toBe(true);
		expect(isDarkCodeSurface({ light: "github-light", dark: "github-dark" })).toBe(false);
	});

	it("scopes the dark tokens onto a default block, in any app theme", () => {
		const { container } = render(<CodeBlock code="const a = 1;" language="ts" highlight={false} />, { wrapper: UiKitTestProviders });
		const root = container.querySelector('[data-slot="code-block"]');
		expect(root?.getAttribute("data-surface")).toBe("dark");
		expect(root?.classList.contains("dark")).toBe(true);
	});

	it("keeps the card surface for an explicit light theme pair", () => {
		const { container } = render(<CodeBlock code="a" language="ts" highlight={false} themes={{ light: "github-light", dark: "github-dark" }} />, {
			wrapper: UiKitTestProviders,
		});
		const root = container.querySelector('[data-slot="code-block"]');
		expect(root?.hasAttribute("data-surface")).toBe(false);
		expect(root?.classList.contains("dark")).toBe(false);
	});

	describe("streaming inside a scrolling ancestor", () => {
		/** Content height of the scrolling ancestor, and how much of it shows. */
		const CONTENT_PX = 2000;
		const VISIBLE_PX = 400;

		/** A scrolling panel (the page's `<main>`, a transcript) of a fixed size, scrolled to `scrollTop`. */
		function scrollingPanel(scrollTop: number): HTMLDivElement {
			const panel = document.createElement("div");
			panel.style.overflowY = "auto";
			Object.defineProperty(panel, "scrollHeight", { configurable: true, get: (): number => CONTENT_PX });
			Object.defineProperty(panel, "clientHeight", { configurable: true, get: (): number => VISIBLE_PX });
			panel.scrollTop = scrollTop;
			document.body.append(panel);
			return panel;
		}

		function streamInto(panel: HTMLDivElement): void {
			const block = (code: string): React.JSX.Element => <CodeBlock code={code} language="ts" highlight={false} streaming />;
			const { rerender } = render(block("a"), { container: panel.appendChild(document.createElement("div")), wrapper: UiKitTestProviders });
			rerender(block("a\nb"));
			rerender(block("a\nb\nc"));
		}

		it("leaves a page the reader is reading further up where it is", () => {
			const panel = scrollingPanel(0);
			streamInto(panel);
			expect(panel.scrollTop).toBe(0);
			panel.remove();
		});

		it("follows the stream when the reader was already at the bottom", () => {
			const panel = scrollingPanel(CONTENT_PX - VISIBLE_PX);
			streamInto(panel);
			expect(panel.scrollTop).toBe(CONTENT_PX);
			panel.remove();
		});
	});
});
