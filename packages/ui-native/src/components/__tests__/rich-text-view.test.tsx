import { fireEvent, render, screen } from "@testing-library/react-native";
import type { RichTextDocument } from "@workspace/shared";
import * as React from "react";

import { richTextLinkHost, RichTextView } from "../rich-text-view";

const DOCUMENT: RichTextDocument = {
	type: "doc",
	content: [
		{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Weekend specials" }] },
		{
			type: "paragraph",
			content: [
				{ type: "text", text: "Half price", marks: [{ type: "bold" }] },
				{ type: "text", text: " — see the " },
				{ type: "text", text: "menu", marks: [{ type: "link", attrs: { href: "https://cafe.example/menu" } }] },
			],
		},
		{ type: "orderedList", attrs: { start: 3 }, content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Latte" }] }] }] },
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

function filesAddress(fileId: string): string {
	return `https://files.example/${fileId}`;
}

describe("RichTextView (native)", () => {
	it("draws the headings, marks, lists, tables and code of a broadcast", async () => {
		await render(<RichTextView document={DOCUMENT} onOpenLink={jest.fn()} />);

		expect(screen.getByRole("header", { name: "Weekend specials" })).toBeOnTheScreen();
		expect(screen.getByText("Half price")).toHaveProp("className", expect.stringContaining("font-sans-semibold"));
		expect(screen.getByText("3.")).toBeOnTheScreen();
		expect(screen.getByText("PROMO-123")).toBeOnTheScreen();
		expect(screen.getByLabelText("Table")).toBeOnTheScreen();
		expect(screen.getByText("Sat")).toBeOnTheScreen();
	});

	it("opens links and the button through the caller, and names the button's real domain", async () => {
		const onOpenLink = jest.fn<undefined, [string]>();
		await render(<RichTextView document={DOCUMENT} onOpenLink={onOpenLink} />);

		await fireEvent.press(screen.getByText("menu"));
		await fireEvent.press(screen.getByRole("button", { name: "Order now" }));

		expect(onOpenLink).toHaveBeenNthCalledWith(1, "https://cafe.example/menu");
		expect(onOpenLink).toHaveBeenNthCalledWith(2, "https://order.cafe.example/start");
		expect(screen.getByText("order.cafe.example")).toBeOnTheScreen();
	});

	it("copies a code block only when the caller can copy", async () => {
		const onCopyCode = jest.fn<undefined, [string]>();
		await render(<RichTextView document={DOCUMENT} onOpenLink={jest.fn()} onCopyCode={onCopyCode} />);

		await fireEvent.press(screen.getByRole("button", { name: "Copy code" }));

		expect(onCopyCode).toHaveBeenCalledWith("PROMO-123");
	});

	it("shows the image only once its address is known", async () => {
		await render(<RichTextView document={DOCUMENT} onOpenLink={jest.fn()} />);
		expect(screen.queryByLabelText("Our latte")).toBeNull();

		await screen.rerender(<RichTextView document={DOCUMENT} onOpenLink={jest.fn()} imageUrl={filesAddress} />);
		expect(screen.getByLabelText("Our latte")).toBeOnTheScreen();
	});
});

describe("richTextLinkHost", () => {
	it("names the host, or the text when it is not a URL", () => {
		expect(richTextLinkHost("https://a.example/x")).toBe("a.example");
		expect(richTextLinkHost("nope")).toBe("nope");
	});
});
