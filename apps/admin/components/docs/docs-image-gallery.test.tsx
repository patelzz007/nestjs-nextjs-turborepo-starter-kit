// @vitest-environment jsdom
//
// Tests for the docs image-gallery feature: a markdown table whose body rows
// all carry an image renders as a responsive card grid (DocsImageGallery),
// while a normal data table (or a mixed-shape table) keeps the regular
// DocsTable. Also covers the pure extraction helper in lib/docs/image-gallery.

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MarkdownRenderer } from "@/components/docs/markdown-renderer";
import { extractImageGalleryItems } from "@/lib/docs/image-gallery";

vi.mock("shiki", () => ({
	createHighlighter: vi.fn().mockResolvedValue({
		codeToHtml: (code: string): string => `<pre class="mocked-shiki"><code>${code}</code></pre>`,
	}),
}));

vi.mock("sonner", () => ({
	toast: {
		success: (): void => undefined,
		error: (): void => undefined,
	},
}));

afterEach(cleanup);

describe("docs image gallery", () => {
	it("renders an all-image table as a card grid (no <table> element)", (): void => {
		const { container } = render(
			<MarkdownRenderer
				content={
					"| Template | Preview |\n|---|---|\n| **Email Verification** (green accent) | ![Email Verification](/docs/images/email/verification.png) |\n| **Password Reset** (indigo) | ![Password Reset](/docs/images/email/password-reset.png) |"
				}
			/>,
		);

		// No data-table chrome: no <table>, no thead/zebra stripes.
		expect(container.querySelector("table")).toBeNull();
		// Two cards, each with a screenshot + a caption.
		expect(container.querySelectorAll("figure").length).toBe(2);
		expect(container.querySelectorAll("img").length).toBe(2);
		// Titles come from the alt text; descriptions from the label cell.
		expect(container.textContent).toContain("Email Verification");
		expect(container.textContent).toContain("green accent");
		// Grid class present.
		expect(container.querySelector("div[class*='grid-cols-1']")).not.toBeNull();
	});

	it("keeps a normal data table as a table (no images)", (): void => {
		const { container } = render(<MarkdownRenderer content={"| Var | Value |\n|---|---|\n| `APP_NAME` | Acme Inc |\n| `PORT` | 8080 |"} />);
		expect(container.querySelector("table")).not.toBeNull();
		expect(container.querySelector("figure")).toBeNull();
	});
	it("keeps a mixed-shape table as a table (image in only one row)", (): void => {
		const { container } = render(
			<MarkdownRenderer content={"| Name | File |\n|---|---|\n| Screenshot | ![logo](/docs/images/email/welcome.png) |\n| README | `readme.md` |"} />,
		);
		// Still a real table (the inline img component wraps its image in a
		// <figure>, so check for the gallery GRID — not figure count).
		expect(container.querySelector("table")).not.toBeNull();
		expect(container.querySelector("div[class*='grid-cols-1']")).toBeNull();
	});

	it("extraction helper returns [] for non-table / empty input", (): void => {
		expect(extractImageGalleryItems(undefined)).toEqual([]);
	});
});
