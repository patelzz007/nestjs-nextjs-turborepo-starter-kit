import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { RichTextDocument } from "@workspace/shared";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { SHEET_MOTION } from "../../lib/motion";
import { RichTextEditor } from "../rich-text-editor";

const LABEL = "Message";

const START: RichTextDocument = {
	type: "doc",
	content: [
		{ type: "paragraph", content: [{ type: "text", text: "Hello world" }] },
		{ type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "one" }] }] }] },
		{ type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Cell" }] }] }] }] },
	],
};

function lastDocument(onChange: jest.Mock<undefined, [RichTextDocument]>): RichTextDocument {
	const [document] = onChange.mock.lastCall ?? [];
	if (document === undefined) {
		throw new Error("The editor reported a change.");
	}
	return document;
}

function input(index: number): ReturnType<typeof screen.getByLabelText> {
	const found = screen.getAllByLabelText(LABEL).at(index);
	if (found === undefined) {
		throw new Error(`There is a text block ${String(index)}.`);
	}
	return found;
}

async function select(index: number, start: number, end: number): Promise<void> {
	await fireEvent(input(index), "selectionChange", { nativeEvent: { selection: { start, end } } });
}

async function settle(): Promise<void> {
	await act((): void => {
		jest.advanceTimersByTime(SHEET_MOTION.exit.duration);
	});
}

beforeEach((): void => {
	jest.useFakeTimers();
});

afterEach((): void => {
	jest.useRealTimers();
});

describe("RichTextEditor", () => {
	it("types into a block and reports the document, with a toolbar named for screen readers", async () => {
		const onChange = jest.fn<undefined, [RichTextDocument]>();
		const ref = React.createRef<ViewInstance>();
		await render(<RichTextEditor ref={ref} initialContent={START} onChange={onChange} label={LABEL} testID="editor" />);
		expect(screen.getByLabelText("Formatting")).toBeOnTheScreen();
		expect(screen.getByText("Kept as it is: edit tables and images on the web.")).toBeOnTheScreen();
		expect(screen.getByText("•", { includeHiddenElements: true })).toBeOnTheScreen();

		await select(0, 11, 11);
		await fireEvent.changeText(input(0), "Hello world!");
		expect(lastDocument(onChange).content.at(0)).toEqual({ type: "paragraph", content: [{ type: "text", text: "Hello world!" }] });
		expect(ref.current).not.toBeNull();
	});

	it("bolds a selection, and makes the next typed text bold at a cursor", async () => {
		const onChange = jest.fn<undefined, [RichTextDocument]>();
		await render(<RichTextEditor initialContent={START} onChange={onChange} label={LABEL} />);
		await select(0, 0, 5);
		await fireEvent.press(screen.getByRole("togglebutton", { name: "Bold" }));
		expect(lastDocument(onChange).content.at(0)).toEqual({
			type: "paragraph",
			content: [
				{ type: "text", text: "Hello", marks: [{ type: "bold" }] },
				{ type: "text", text: " world" },
			],
		});
		expect(screen.getByRole("togglebutton", { name: "Bold" })).toHaveProp("accessibilityState", expect.objectContaining({ checked: true }));

		await select(0, 11, 11);
		await fireEvent.press(screen.getByRole("togglebutton", { name: "Italic" }));
		await fireEvent.press(screen.getByRole("togglebutton", { name: "Italic" }));
		await fireEvent.press(screen.getByRole("togglebutton", { name: "Italic" }));
		expect(screen.getByRole("togglebutton", { name: "Italic" })).toHaveProp("accessibilityState", expect.objectContaining({ checked: true }));
		await fireEvent.changeText(input(0), "Hello world too");
		expect(lastDocument(onChange).content.at(0)).toEqual({
			type: "paragraph",
			content: [
				{ type: "text", text: "Hello", marks: [{ type: "bold" }] },
				{ type: "text", text: " world" },
				{ type: "text", text: " too", marks: [{ type: "italic" }] },
			],
		});
	});

	it("splits a block at Enter, continues a list, and ends it on an empty item", async () => {
		const onChange = jest.fn<undefined, [RichTextDocument]>();
		await render(<RichTextEditor initialContent={START} onChange={onChange} label={LABEL} />);
		await select(0, 5, 5);
		await fireEvent.changeText(input(0), "Hello\n world");
		expect(lastDocument(onChange).content.slice(0, 2)).toEqual([
			{ type: "paragraph", content: [{ type: "text", text: "Hello" }] },
			{ type: "paragraph", content: [{ type: "text", text: " world" }] },
		]);

		await select(2, 3, 3);
		await fireEvent.changeText(input(2), "one\n");
		expect(screen.getAllByText("•", { includeHiddenElements: true })).toHaveLength(2);
		await fireEvent.changeText(input(3), "\n");
		expect(screen.getAllByText("•", { includeHiddenElements: true })).toHaveLength(1);
		expect(lastDocument(onChange).content.map((block) => block.type)).toEqual(["paragraph", "paragraph", "bulletList", "paragraph", "table"]);
	});

	it("joins a block to the one before at Backspace, removes an atom before it, and turns a first block back into a paragraph", async () => {
		const onChange = jest.fn<undefined, [RichTextDocument]>();
		const document: RichTextDocument = {
			type: "doc",
			content: [
				{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Title" }] },
				{ type: "paragraph", content: [{ type: "text", text: "Body" }] },
				{ type: "horizontalRule" },
				{ type: "paragraph", content: [{ type: "text", text: "End" }] },
			],
		};
		await render(<RichTextEditor initialContent={document} onChange={onChange} label={LABEL} />);
		await select(2, 0, 0);
		await fireEvent(input(2), "keyPress", { nativeEvent: { key: "Backspace" } });
		expect(lastDocument(onChange).content.map((block) => block.type)).toEqual(["heading", "paragraph", "paragraph"]);
		await select(1, 0, 0);
		await fireEvent(input(1), "keyPress", { nativeEvent: { key: "Backspace" } });
		expect(lastDocument(onChange).content.at(0)).toEqual({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "TitleBody" }] });
		await select(0, 0, 0);
		await fireEvent(input(0), "keyPress", { nativeEvent: { key: "Backspace" } });
		expect(lastDocument(onChange).content.at(0)?.type).toBe("paragraph");
		const calls = onChange.mock.calls.length;
		await fireEvent(input(0), "keyPress", { nativeEvent: { key: "Backspace" } });
		await fireEvent(input(0), "keyPress", { nativeEvent: { key: "a" } });
		expect(onChange).toHaveBeenCalledTimes(calls);
	});

	it("changes a block's kind and back, keeps a code block's line breaks, and undoes and redoes", async () => {
		const onChange = jest.fn<undefined, [RichTextDocument]>();
		await render(<RichTextEditor initialContent={null} onChange={onChange} label={LABEL} placeholder="Write something" />);
		expect(input(0)).toHaveProp("placeholder", "Write something");
		await select(0, 0, 0);
		for (const name of ["Heading", "Subheading", "Numbered list", "Quote"]) {
			await fireEvent.press(screen.getByRole("togglebutton", { name }));
		}
		expect(lastDocument(onChange).content.at(0)?.type).toBe("blockquote");
		await fireEvent.press(screen.getByRole("togglebutton", { name: "Quote" }));
		await fireEvent.press(screen.getByRole("togglebutton", { name: "Code block" }));
		await fireEvent.changeText(input(0), "a\nb");
		expect(lastDocument(onChange).content).toEqual([{ type: "codeBlock", content: [{ type: "text", text: "a\nb" }] }]);
		expect(screen.getByRole("togglebutton", { name: "Bold" })).toBeDisabled();
		await fireEvent.changeText(input(0), "");
		expect(lastDocument(onChange).content).toEqual([{ type: "codeBlock" }]);

		await fireEvent.press(screen.getByRole("button", { name: "Undo" }));
		expect(lastDocument(onChange).content).toEqual([{ type: "codeBlock", content: [{ type: "text", text: "a\nb" }] }]);
		await fireEvent.press(screen.getByRole("button", { name: "Redo" }));
		expect(lastDocument(onChange).content).toEqual([{ type: "codeBlock" }]);
		expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled();
	});

	it("links a selection to an https address, refuses anything else, and removes the link", async () => {
		const onChange = jest.fn<undefined, [RichTextDocument]>();
		await render(<RichTextEditor initialContent={START} onChange={onChange} label={LABEL} />);
		await select(0, 6, 11);
		await fireEvent.press(screen.getByRole("togglebutton", { name: "Link" }));
		await fireEvent.changeText(screen.getByLabelText("Link address"), "http://example.com");
		await fireEvent.press(screen.getByRole("button", { name: "Apply" }));
		expect(screen.getByText("Links must be full https:// addresses.")).toBeOnTheScreen();
		await fireEvent.changeText(screen.getByLabelText("Link address"), "https://example.com");
		await fireEvent.press(screen.getByRole("button", { name: "Apply" }));
		await settle();
		expect(lastDocument(onChange).content.at(0)).toEqual({
			type: "paragraph",
			content: [
				{ type: "text", text: "Hello " },
				{ type: "text", text: "world", marks: [{ type: "link", attrs: { href: "https://example.com" } }] },
			],
		});

		await select(0, 8, 8);
		await fireEvent.press(screen.getByRole("togglebutton", { name: "Link" }));
		expect(screen.getByLabelText("Link address")).toHaveProp("value", "https://example.com");
		await select(0, 6, 11);
		await fireEvent.press(screen.getByRole("button", { name: "Remove link" }));
		await settle();
		expect(lastDocument(onChange).content.at(0)).toEqual({ type: "paragraph", content: [{ type: "text", text: "Hello world" }] });
	});

	it("inserts a divider and the one button a broadcast may hold, and removes them", async () => {
		const onChange = jest.fn<undefined, [RichTextDocument]>();
		await render(<RichTextEditor initialContent={START} onChange={onChange} label={LABEL} />);
		await select(0, 0, 0);
		await fireEvent.press(screen.getByRole("button", { name: "Divider" }));
		expect(lastDocument(onChange).content.at(1)).toEqual({ type: "horizontalRule" });

		await fireEvent.press(screen.getByRole("button", { name: "Button" }));
		await fireEvent.press(screen.getByRole("button", { name: "Insert" }));
		expect(screen.getByText("Links must be full https:// addresses.")).toBeOnTheScreen();
		await fireEvent.changeText(screen.getByLabelText("Button text"), "Open the app");
		await fireEvent.changeText(screen.getByLabelText("Button link"), "https://example.com/app");
		await fireEvent.press(screen.getByRole("button", { name: "Insert" }));
		await settle();
		expect(lastDocument(onChange).content.at(1)).toEqual({ type: "callToAction", attrs: { label: "Open the app", href: "https://example.com/app" } });
		expect(screen.getByRole("button", { name: "Button" })).toBeDisabled();

		await fireEvent.press(screen.getByRole("button", { name: "Remove Button" }));
		await fireEvent.press(screen.getByRole("button", { name: "Remove Divider" }));
		await fireEvent.press(screen.getByRole("button", { name: "Remove table" }));
		expect(lastDocument(onChange).content.map((block) => block.type)).toEqual(["paragraph", "bulletList"]);
	});

	it("numbers the items of a numbered list, and takes a focused block as the one to format", async () => {
		const numbered: RichTextDocument = {
			type: "doc",
			content: [
				{
					type: "orderedList",
					content: [
						{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "a" }] }] },
						{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "b" }] }] },
					],
				},
			],
		};
		await render(<RichTextEditor initialContent={numbered} onChange={jest.fn()} label={LABEL} />);
		expect(screen.getByText("1.", { includeHiddenElements: true })).toBeOnTheScreen();
		expect(screen.getByText("2.", { includeHiddenElements: true })).toBeOnTheScreen();
		await fireEvent(input(1), "focus");
		expect(screen.getByRole("togglebutton", { name: "Numbered list" })).toHaveProp("accessibilityState", expect.objectContaining({ checked: true }));
	});

	it("shows only the short toolbar when compact, with nothing to format until a block is chosen", async () => {
		await render(<RichTextEditor initialContent={null} onChange={jest.fn()} label={LABEL} compact />);
		expect(screen.queryByRole("togglebutton", { name: "Heading" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Divider" })).toBeNull();
		expect(screen.getByRole("togglebutton", { name: "Bulleted list" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
	});
});
