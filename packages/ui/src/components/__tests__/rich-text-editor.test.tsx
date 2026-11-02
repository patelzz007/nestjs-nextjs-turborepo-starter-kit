// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { JSONContent } from "@tiptap/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RichTextEditor, useRichTextEditor } from "@workspace/ui/components/rich-text-editor";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";

const INITIAL: JSONContent = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }] };

interface HarnessProps {
	readonly onChange: (content: JSONContent) => void;
	readonly disabled?: boolean;
	readonly onReady?: (editor: NonNullable<ReturnType<typeof useRichTextEditor>>) => void;
}

function Harness({ onChange, disabled = false, onReady }: HarnessProps): React.JSX.Element {
	const editor = useRichTextEditor({ initialContent: INITIAL, onChange, placeholder: "Write your message", label: "Message" });
	React.useEffect((): void => {
		if (editor !== null) {
			onReady?.(editor);
		}
	}, [editor, onReady]);
	return (
		<RichTextEditor editor={editor} disabled={disabled}>
			<RichTextEditor.Toolbar>
				<RichTextEditor.ControlsGroup>
					<RichTextEditor.Bold />
					<RichTextEditor.H2 />
					<RichTextEditor.Table />
					<RichTextEditor.Link />
					<RichTextEditor.CallToAction />
				</RichTextEditor.ControlsGroup>
			</RichTextEditor.Toolbar>
			<RichTextEditor.Content />
			<RichTextEditor.Footer limit={100} />
		</RichTextEditor>
	);
}

afterEach((): void => {
	cleanup();
});

describe("RichTextEditor", () => {
	it("starts from the given document in a labelled writing area", async () => {
		render(<Harness onChange={vi.fn()} />, { wrapper: UiKitTestProviders });

		await waitFor((): void => {
			expect(screen.getByRole("textbox", { name: "Message" }).textContent).toBe("Hello");
		});
		expect(screen.getByRole("toolbar", { name: "Formatting" })).toBeTruthy();
		// Controls read the editor from their first render: usable before anything is typed.
		expect(screen.getByRole("button", { name: "Bold" }).hasAttribute("disabled")).toBe(false);
		await waitFor((): void => {
			expect(document.querySelector('[data-slot="rich-text-editor-footer"]')?.textContent).toBe("5 / 100");
		});
	});

	it("reports every change as JSON", async () => {
		const onChange = vi.fn<(content: JSONContent) => void>();
		const onReady = vi.fn<(editor: NonNullable<ReturnType<typeof useRichTextEditor>>) => void>();
		render(<Harness onChange={onChange} onReady={onReady} />, { wrapper: UiKitTestProviders });
		await waitFor((): void => {
			expect(onReady).toHaveBeenCalled();
		});
		act((): void => {
			onReady.mock.lastCall?.at(0)?.chain().selectAll().toggleBold().run();
		});

		expect(JSON.stringify(onChange.mock.lastCall?.at(0))).toContain('"bold"');
	});

	it("hides the toolbar and stops editing while disabled", async () => {
		render(<Harness onChange={vi.fn()} disabled />, { wrapper: UiKitTestProviders });

		await waitFor((): void => {
			expect(screen.getByRole("textbox", { name: "Message" }).getAttribute("contenteditable")).toBe("false");
		});
		expect(screen.queryByRole("toolbar")).toBeNull();
	});

	it("only offers a link once words are selected", async () => {
		render(<Harness onChange={vi.fn()} />, { wrapper: UiKitTestProviders });

		await waitFor((): void => {
			expect(screen.getByRole("button", { name: "Link" }).hasAttribute("disabled")).toBe(true);
		});
	});
});
