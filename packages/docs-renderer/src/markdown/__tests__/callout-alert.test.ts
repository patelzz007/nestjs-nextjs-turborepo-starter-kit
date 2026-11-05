import type { Element, ElementContent, Root } from "hast";
import { toHtml } from "hast-util-to-html";
import { describe, expect, it } from "vitest";

import { CALLOUT_VARIANTS, calloutKind, calloutToAlert, rehypeCalloutAlert } from "../callout-alert";

function paragraph(text: string, className?: string): Element {
	return { type: "element", tagName: "p", properties: className === undefined ? {} : { className: [className] }, children: [{ type: "text", value: text }] };
}

function callout(kind: string | undefined, children: ElementContent[]): Element {
	return { type: "element", tagName: "aside", properties: { className: ["callout"], ...(kind === undefined ? {} : { dataKind: kind }) }, children };
}

function render(node: Element): string {
	return toHtml({ type: "root", children: [...calloutToAlert(node)] }, { allowDangerousHtml: true });
}

describe("callout → shared Alert", () => {
	it("should map every callout kind to an Alert variant", () => {
		expect(CALLOUT_VARIANTS).toEqual({ info: "info", tip: "success", success: "success", warning: "warning", error: "destructive" });
	});

	it("should read the kind from data-kind and fall back to info", () => {
		expect(calloutKind(callout("warning", []))).toBe("warning");
		// remarkCallouts' hProperties reach hast verbatim, hyphenated (regression: every callout rendered as info).
		expect(calloutKind({ type: "element", tagName: "aside", properties: { className: ["callout"], "data-kind": "error" }, children: [] })).toBe("error");
		expect(calloutKind(callout("not-a-kind", []))).toBe("info");
		expect(calloutKind(callout(undefined, []))).toBe("info");
	});

	it("should render a titled callout as an Alert note with its title and the original content", () => {
		const html = render(callout("warning", [paragraph("Warning", "callout-title"), paragraph("SuperAdmin skips permission checks.")]));
		expect(html).toContain('data-slot="alert"');
		expect(html).toContain('data-variant="warning"');
		expect(html).toContain('role="note"');
		expect(html).toMatch(/data-slot="alert-title"[^>]*>Warning</);
		expect(html).toContain("<p>SuperAdmin skips permission checks.</p>");
		expect(html).not.toContain("callout-content");
	});

	it("should find the title past the newline text node remark → hast leaves before it", () => {
		const html = render(callout("warning", [{ type: "text", value: "\n" }, paragraph("Warning", "callout-title"), paragraph("Body.")]));
		expect(html).toMatch(/data-slot="alert-title"[^>]*>Warning</);
		expect(html).not.toContain("callout-title");
	});

	it("should render an untitled callout without a title and keep every child", () => {
		const html = render(callout("tip", [paragraph("First."), paragraph("Second.")]));
		expect(html).toContain('data-variant="success"');
		expect(html).not.toContain('data-slot="alert-title"');
		expect(html).toContain("<p>First.</p><p>Second.</p>");
	});

	it("should replace every callout aside in a tree and leave other asides alone", () => {
		const other: Element = { type: "element", tagName: "aside", properties: { className: ["note"] }, children: [] };
		const tree: Root = { type: "root", children: [callout("error", [paragraph("Never run db:reset.")]), other] };
		rehypeCalloutAlert()(tree);
		const html = toHtml(tree, { allowDangerousHtml: true });
		expect(html).toContain('data-variant="destructive"');
		expect(html).toContain('<aside class="note"></aside>');
		expect(html).not.toContain('<aside class="callout"');
	});
});
