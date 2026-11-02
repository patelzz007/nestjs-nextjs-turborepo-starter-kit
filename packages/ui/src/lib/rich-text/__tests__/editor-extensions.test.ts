// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { RichTextDocumentSchema } from "@workspace/shared";
import { afterEach, describe, expect, it } from "vitest";

import { broadcastEditorExtensions, isAllowedBroadcastLink } from "@workspace/ui/lib/rich-text/editor-extensions";

let editor: Editor | undefined;

function newEditor(content: string): Editor {
	editor = new Editor({ extensions: broadcastEditorExtensions({ placeholder: "Write" }), content });
	return editor;
}

afterEach((): void => {
	editor?.destroy();
	editor = undefined;
});

describe("broadcast editor extensions", () => {
	it("writes JSON the shared broadcast schema accepts", () => {
		const current = newEditor(
			'<h2>News</h2><p><strong>Bold</strong> <em>it</em> <u>u</u> <s>s</s> <code>c</code> <a href="https://example.com">link</a></p><ul><li><p>one</p></li></ul><ol><li><p>two</p></li></ol><blockquote><p>q</p></blockquote><hr><pre><code>x = 1</code></pre>',
		);
		current.chain().focus("end").insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run();
		current.chain().focus("end").insertCallToAction({ label: "See menu", href: "https://example.com/menu" }).run();

		const result = RichTextDocumentSchema.safeParse(current.getJSON());
		expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
	});

	it("keeps a button out of a table cell", () => {
		const current = newEditor("<p>x</p>");
		current.chain().focus("end").insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run();
		current.chain().insertCallToAction({ label: "Go", href: "https://example.com" }).run();

		expect(RichTextDocumentSchema.safeParse(current.getJSON()).success).toBe(true);
	});

	it("drops what a broadcast may not hold: H1, colours and unknown tags", () => {
		const json = newEditor('<h1>Big</h1><p><span style="color: red">red</span></p><iframe src="https://x.test"></iframe>').getJSON();

		expect(JSON.stringify(json)).not.toMatch(/"level":1|color|iframe/u);
		expect(RichTextDocumentSchema.safeParse(json).success).toBe(true);
	});

	it("never keeps a non-https link", () => {
		const json = newEditor('<p><a href="http://example.com">plain</a> <a href="javascript:alert(1)">bad</a></p>').getJSON();

		expect(JSON.stringify(json)).not.toMatch(/"link"/u);
	});
});

describe("isAllowedBroadcastLink", () => {
	it("accepts only absolute https links", () => {
		expect(isAllowedBroadcastLink("https://example.com/a")).toBe(true);
		expect(isAllowedBroadcastLink("http://example.com")).toBe(false);
		expect(isAllowedBroadcastLink("/relative")).toBe(false);
		expect(isAllowedBroadcastLink("javascript:alert(1)")).toBe(false);
	});
});
