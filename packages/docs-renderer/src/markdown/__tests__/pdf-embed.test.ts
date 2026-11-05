import type { Root, RootContent } from "mdast";
import { describe, expect, it } from "vitest";

import { PDF_EMBED_ATTRIBUTE, PDF_EMBED_TEXT, PDF_FENCE_LANGUAGE, pdfEmbedFileName, pdfEmbedHtml, PdfEmbedUrlSchema, remarkPdfEmbed } from "../pdf-embed";

function rootOf(children: RootContent[]): Root {
	return { type: "root", children };
}

describe("PdfEmbedUrlSchema", () => {
	it("accepts a site path or an https URL", () => {
		expect(PdfEmbedUrlSchema.safeParse("/files/pdf-viewer-sample.pdf").success).toBe(true);
		expect(PdfEmbedUrlSchema.safeParse("https://example.com/a.pdf?x=1").success).toBe(true);
	});

	it("rejects protocol-relative, plain-http, script and relative URLs", () => {
		for (const url of ["//evil.example/a.pdf", "http://example.com/a.pdf", "javascript:alert(1)", "files/a.pdf", "/files/a b.pdf", ""]) {
			expect(PdfEmbedUrlSchema.safeParse(url).success, url).toBe(false);
		}
	});
});

describe("pdfEmbedFileName", () => {
	it("uses the fence title, as a PDF file name", () => {
		expect(pdfEmbedFileName("/files/x.pdf", "Sample statement")).toBe("Sample statement.pdf");
	});

	it("falls back to the URL's last segment, without its query or fragment", () => {
		expect(pdfEmbedFileName("https://example.com/docs/Annual%20report.pdf?v=2#page=3", null)).toBe("Annual report.pdf");
		expect(pdfEmbedFileName("/files/", null)).toBe("document.pdf");
	});
});

describe("pdfEmbedHtml", () => {
	it("frames the PDF under a header with the name, new-tab and download links", () => {
		const html = pdfEmbedHtml("/files/pdf-viewer-sample.pdf", "Sample.pdf");
		expect(html.startsWith(`<figure class="pdf-embed" ${PDF_EMBED_ATTRIBUTE}>`)).toBe(true);
		expect(html).toContain('<span class="pdf-embed-name">Sample.pdf</span>');
		expect(html).toContain(`href="/files/pdf-viewer-sample.pdf" target="_blank" rel="noopener noreferrer">${PDF_EMBED_TEXT.openInNewTab}</a>`);
		expect(html).toContain(`href="/files/pdf-viewer-sample.pdf" download="Sample.pdf">${PDF_EMBED_TEXT.download}</a>`);
		expect(html).toContain('<iframe class="pdf-embed-frame" src="/files/pdf-viewer-sample.pdf" title="PDF: Sample.pdf" loading="lazy" referrerpolicy="no-referrer"></iframe>');
		expect(html).toContain(`<p class="pdf-embed-unsupported" hidden>${PDF_EMBED_TEXT.inlineUnsupported}</p>`);
	});

	it("escapes the URL and the name", () => {
		const html = pdfEmbedHtml("https://example.com/a.pdf?x=1&y=<2>", 'Q"3" <b>');
		expect(html).toContain('href="https://example.com/a.pdf?x=1&amp;y=&lt;2&gt;"');
		expect(html).not.toContain("<b>");
	});

	it("fails the build on a URL it will not embed", () => {
		expect(() => pdfEmbedHtml("javascript:alert(1)", null)).toThrow();
	});
});

describe("remarkPdfEmbed", () => {
	it("replaces pdf fences with their embed and leaves other fences alone", () => {
		const tree = rootOf([
			{ type: "code", lang: PDF_FENCE_LANGUAGE, meta: 'title="Sample.pdf"', value: "  /files/pdf-viewer-sample.pdf\n" },
			{ type: "code", lang: "ts", meta: null, value: "const a = 1;" },
		]);
		remarkPdfEmbed()(tree);
		const [embed, code] = tree.children;
		expect(embed?.type).toBe("html");
		expect(embed?.type === "html" ? embed.value : "").toBe(pdfEmbedHtml("/files/pdf-viewer-sample.pdf", "Sample.pdf"));
		expect(code?.type).toBe("code");
	});
});
