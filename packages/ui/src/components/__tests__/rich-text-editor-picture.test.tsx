// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { JSONContent } from "@tiptap/react";
import * as React from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { RichTextEditor, useRichTextEditor, type UploadedPicture } from "@workspace/ui/components/rich-text-editor";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";

const INITIAL: JSONContent = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }] };
const PICTURE: UploadedPicture = { fileId: "0190f0e0-0000-7000-8000-000000000001", src: "https://cdn.example.com/cake.webp" };

function Harness({ upload, onChange }: { readonly upload: (file: File) => Promise<UploadedPicture>; readonly onChange: (content: JSONContent) => void }): React.JSX.Element {
	const editor = useRichTextEditor({ initialContent: INITIAL, onChange, placeholder: "Write your message", label: "Message" });
	return (
		<RichTextEditor editor={editor}>
			<RichTextEditor.Toolbar>
				<RichTextEditor.ControlsGroup>
					<RichTextEditor.Picture upload={upload} accept="image/png,image/webp" />
				</RichTextEditor.ControlsGroup>
			</RichTextEditor.Toolbar>
			<RichTextEditor.Content />
		</RichTextEditor>
	);
}

afterEach((): void => {
	cleanup();
});

// jsdom does no layout: inserting a block scrolls the editor to it, which asks for the selection's rectangles.
// An empty list is what a browser gives for something not laid out; restored after this file.
const EMPTY_RECTS: DOMRectList = { length: 0, item: (): null => null, [Symbol.iterator]: (): ArrayIterator<DOMRect> => new Array<DOMRect>().values() };
const LAYOUT: readonly [object, string, () => DOMRectList | DOMRect][] = [
	[Element.prototype, "getClientRects", (): DOMRectList => EMPTY_RECTS],
	[Range.prototype, "getClientRects", (): DOMRectList => EMPTY_RECTS],
	[Range.prototype, "getBoundingClientRect", (): DOMRect => new DOMRect(0, 0, 0, 0)],
];
const originals = LAYOUT.map(([target, name]): PropertyDescriptor | undefined => Object.getOwnPropertyDescriptor(target, name));
beforeAll((): void => {
	for (const [target, name, value] of LAYOUT) {
		Object.defineProperty(target, name, { configurable: true, writable: true, value });
	}
});
afterAll((): void => {
	LAYOUT.forEach(([target, name], index): void => {
		const original = originals.at(index);
		if (original === undefined) {
			Reflect.deleteProperty(target, name);
		} else {
			Object.defineProperty(target, name, original);
		}
	});
});

async function openPicture(): Promise<void> {
	await waitFor((): void => {
		expect(screen.getByRole("button", { name: "Add a picture" }).hasAttribute("disabled")).toBe(false);
	});
	act((): void => {
		fireEvent.click(screen.getByRole("button", { name: "Add a picture" }));
	});
}

function choose(alt: string): void {
	act((): void => {
		fireEvent.change(screen.getByLabelText("Picture"), { target: { files: [new File(["x"], "cake.webp", { type: "image/webp" })] } });
		fireEvent.change(screen.getByLabelText(/Describe it/u), { target: { value: alt } });
	});
}

describe("RichTextEditor.Picture (enhancement 5.4)", () => {
	it("uploads the chosen file, then puts the picture in by file id with its description", async () => {
		const upload = vi.fn<(file: File) => Promise<UploadedPicture>>().mockResolvedValue(PICTURE);
		const onChange = vi.fn<(content: JSONContent) => void>();
		render(<Harness upload={upload} onChange={onChange} />, { wrapper: UiKitTestProviders });
		await openPicture();
		expect(screen.getByRole("button", { name: "Add picture" }).hasAttribute("disabled")).toBe(true);
		choose("A slice of chocolate cake");
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Add picture" }));
		});
		await waitFor((): void => {
			expect(onChange).toHaveBeenCalled();
		});
		expect(upload.mock.lastCall?.at(0)?.name).toBe("cake.webp");
		const image = onChange.mock.lastCall?.at(0)?.content?.find((node) => node.type === "image");
		// Tiptap builds its attribute objects itself: compare the values.
		expect(image?.attrs).toEqual({ fileId: PICTURE.fileId, alt: "A slice of chocolate cake", src: PICTURE.src });
		// One picture per message: the control turns off once it holds one.
		await waitFor((): void => {
			expect(screen.getByRole("button", { name: "Add a picture" }).hasAttribute("disabled")).toBe(true);
		});
	});

	it("needs a description, and says why an upload failed without changing the message", async () => {
		const upload = vi.fn<(file: File) => Promise<UploadedPicture>>().mockRejectedValue(new Error("That file isn't a picture we accept."));
		const onChange = vi.fn<(content: JSONContent) => void>();
		render(<Harness upload={upload} onChange={onChange} />, { wrapper: UiKitTestProviders });
		await openPicture();
		choose("   ");
		expect(screen.getByRole("button", { name: "Add picture" }).hasAttribute("disabled")).toBe(true);
		choose("A cake");
		act((): void => {
			fireEvent.click(screen.getByRole("button", { name: "Add picture" }));
		});
		await waitFor((): void => {
			expect(screen.getByRole("alert").textContent).toBe("That file isn't a picture we accept.");
		});
		expect(onChange).not.toHaveBeenCalled();
	});
});
