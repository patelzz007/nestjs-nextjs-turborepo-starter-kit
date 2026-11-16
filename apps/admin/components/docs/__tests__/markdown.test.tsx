// @vitest-environment jsdom
import { render } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it } from "vitest";

import { Markdown, type MarkdownFences } from "@/components/docs/markdown";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";

const SOURCE = ["# Guide", "", "```owned", "the body", "```", "", "```ts", "const answer = 42;", "```"].join("\n");

const FENCES: MarkdownFences = {
	owned: (body: string): React.ReactNode => <output data-testid="owned">{body}</output>,
};

describe("Markdown", () => {
	it("hands a fence in a language the page owns to its renderer, and draws other fences as code", () => {
		const { container, getByTestId } = render(<Markdown source={SOURCE} fences={FENCES} />, { wrapper: UiKitTestProviders });

		expect(getByTestId("owned").textContent).toBe("the body");
		expect(container.querySelectorAll('[data-slot="code-block"]')).toHaveLength(1);
	});

	it("draws every fence as code when the page owns none", () => {
		const { container } = render(<Markdown source={SOURCE} />, { wrapper: UiKitTestProviders });

		expect(container.querySelectorAll('[data-slot="code-block"]')).toHaveLength(2);
	});

	it("gives section headings the outline's ids, each with a link to itself", () => {
		const { getByRole } = render(<Markdown source={"## Going live\n\n### The `env` file\n"} />, { wrapper: UiKitTestProviders });

		expect(getByRole("heading", { level: 2, name: "Going live" }).id).toBe("going-live");
		expect(getByRole("heading", { level: 3 }).id).toBe("the-env-file");
		const [anchor] = getByRole("heading", { level: 2 }).parentElement?.querySelectorAll("a") ?? [];
		expect(anchor?.getAttribute("href")).toBe("#going-live");
		expect(anchor?.getAttribute("aria-label")).toBe("Link to this section");
	});

	it("keeps in-page links in the same tab, and opens external ones in a new one", () => {
		const { getByRole } = render(<Markdown source={"[up](#going-live) and [Base UI](https://base-ui.com)"} />, { wrapper: UiKitTestProviders });

		expect(getByRole("link", { name: "up" }).hasAttribute("target")).toBe(false);
		expect(getByRole("link", { name: "Base UI" }).getAttribute("target")).toBe("_blank");
	});
});
