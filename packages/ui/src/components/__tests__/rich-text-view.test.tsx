// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import type { RichTextDocument } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { richTextLinkHost, RichTextView } from "@workspace/ui/components/rich-text-view";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";

const DOCUMENT: RichTextDocument = {
	type: "doc",
	content: [
		{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Weekend specials" }] },
		{
			type: "paragraph",
			content: [
				{ type: "text", text: "Half price", marks: [{ type: "bold" }] },
				{ type: "hardBreak" },
				{ type: "text", text: "menu", marks: [{ type: "link", attrs: { href: "https://cafe.example/menu" } }] },
			],
		},
		{ type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Latte" }] }] }] },
		{ type: "codeBlock", attrs: { language: "text" }, content: [{ type: "text", text: "PROMO-123" }] },
		{
			type: "table",
			content: [
				{ type: "tableRow", content: [{ type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Day" }] }] }] },
				{ type: "tableRow", content: [{ type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Sat" }] }] }] },
			],
		},
		{ type: "image", attrs: { fileId: "f1", alt: "Our latte" } },
		{ type: "callToAction", attrs: { label: "Order now", href: "https://order.cafe.example/start" } },
	],
};

afterEach((): void => {
	cleanup();
});

function renderView(imageUrl?: (fileId: string) => string | undefined): void {
	render(<RichTextView document={DOCUMENT} imageUrl={imageUrl} />, { wrapper: UiKitTestProviders });
}

describe("RichTextView", () => {
	it("draws headings, marks, links and lists from the JSON", () => {
		renderView();

		expect(screen.getByRole("heading", { level: 2, name: "Weekend specials" })).toBeTruthy();
		expect(screen.getByText("Half price").tagName).toBe("STRONG");
		expect(screen.getByRole("link", { name: "menu" }).getAttribute("href")).toBe("https://cafe.example/menu");
		expect(screen.getByRole("link", { name: "menu" }).getAttribute("rel")).toContain("noopener");
		expect(screen.getByRole("listitem").textContent).toBe("Latte");
	});

	it("puts tables in a sideways-scrolling region with a real header cell", () => {
		renderView();
		const table = within(screen.getByRole("region", { name: "Table" }));

		expect(table.getByRole("columnheader", { name: "Day" })).toBeTruthy();
		expect(table.getByRole("cell", { name: "Sat" })).toBeTruthy();
	});

	it("gives a code block a copy button", () => {
		renderView();

		expect(screen.getByText("PROMO-123")).toBeTruthy();
		expect(screen.getByRole("button", { name: /copy/iu })).toBeTruthy();
	});

	it("shows the button's real domain beside it", () => {
		renderView();

		expect(screen.getByRole("link", { name: "Order now" }).getAttribute("href")).toBe("https://order.cafe.example/start");
		expect(screen.getByText("order.cafe.example")).toBeTruthy();
	});

	it("shows the image only when its address is known", () => {
		renderView();
		expect(screen.queryByRole("img")).toBeNull();
		cleanup();
		renderView((fileId) => `https://files.example/${fileId}`);
		expect(screen.getByRole("img", { name: "Our latte" }).getAttribute("src")).toBe("https://files.example/f1");
	});
});

describe("richTextLinkHost", () => {
	it("names the host, or the text itself when it is not a URL", () => {
		expect(richTextLinkHost("https://a.example/x")).toBe("a.example");
		expect(richTextLinkHost("not a url")).toBe("not a url");
	});
});
