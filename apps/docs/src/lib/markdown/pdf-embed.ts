import { pdfFileName } from "@workspace/shared";
import type { Code, Html, Root } from "mdast";
import { visit } from "unist-util-visit";
import { z } from "zod";

import { parseCodeTitle } from "./fence-meta";
import { escapeHtml } from "./html";

/**
 * ```` ```pdf ```` fences become an embedded PDF: the docs' own header (file name, open in a
 * new tab, download) above a frame the browser's built-in PDF engine draws the pages in —
 * the same approach as the apps' `PdfViewer`, with no PDF library (docs/technical/frontend/pdf-viewer.md).
 * The fence body is the PDF's URL: a path on this site (`/files/…`) or an `https://` URL;
 * `title="…"` is the file name shown (otherwise the URL's last segment). Where the browser
 * cannot show PDFs inline, `src/scripts/pdf-embeds.ts` swaps the frame for a note.
 *
 * ````md
 * ```pdf title="Sample statement.pdf"
 * /files/pdf-viewer-sample.pdf
 * ```
 * ````
 */

/** The fence language that marks an embedded PDF. */
export const PDF_FENCE_LANGUAGE = "pdf";

/** Marks an embed for `src/scripts/pdf-embeds.ts`. */
export const PDF_EMBED_ATTRIBUTE = "data-pdf-embed";

/** A site path (`/files/a.pdf`, never protocol-relative `//host`) or an absolute https URL. */
export const PdfEmbedUrlSchema = z.union([z.string().regex(/^\/(?!\/)\S*$/), z.url({ protocol: /^https$/ })]);

/** The copy of an embed — the docs are written in English. */
export const PDF_EMBED_TEXT = {
	openInNewTab: "Open in new tab",
	download: "Download",
	frameTitle: (fileName: string): string => `PDF: ${fileName}`,
	inlineUnsupported: "This browser can't show PDFs here. Open it in a new tab or download it to read it.",
} satisfies Readonly<Record<string, string | ((fileName: string) => string)>>;

/** The name an embed shows and downloads as: the fence title, or the URL's last path segment. */
export function pdfEmbedFileName(url: string, title: string | null): string {
	if (title !== null) {
		return pdfFileName(title);
	}
	const path = url.split(/[?#]/).at(0) ?? "";
	return pdfFileName(decodeURIComponent(path.split("/").at(-1) ?? ""));
}

/** The HTML of one embed. Throws (failing the build) when the fence body is not a usable URL. */
export function pdfEmbedHtml(rawUrl: string, title: string | null): string {
	const url = PdfEmbedUrlSchema.parse(rawUrl);
	const fileName = pdfEmbedFileName(url, title);
	const href = escapeHtml(url);
	const name = escapeHtml(fileName);
	return (
		`<figure class="pdf-embed" ${PDF_EMBED_ATTRIBUTE}>` +
		`<figcaption class="pdf-embed-header">` +
		`<span class="pdf-embed-name">${name}</span>` +
		`<a class="pdf-embed-action" href="${href}" target="_blank" rel="noopener noreferrer">${PDF_EMBED_TEXT.openInNewTab}</a>` +
		`<a class="pdf-embed-action" href="${href}" download="${name}">${PDF_EMBED_TEXT.download}</a>` +
		`</figcaption>` +
		`<iframe class="pdf-embed-frame" src="${href}" title="${escapeHtml(PDF_EMBED_TEXT.frameTitle(fileName))}" loading="lazy" referrerpolicy="no-referrer"></iframe>` +
		`<p class="pdf-embed-unsupported" hidden>${PDF_EMBED_TEXT.inlineUnsupported}</p>` +
		`</figure>`
	);
}

/** Replaces every `pdf` fence with its embed (before `rehypeCodeBlock`, so it is never highlighted as code). */
export function remarkPdfEmbed(): (tree: Root) => void {
	return (tree: Root): void => {
		visit(tree, "code", (node: Code, index, parent) => {
			if (node.lang !== PDF_FENCE_LANGUAGE || parent === undefined || index === undefined) {
				return;
			}
			const html: Html = { type: "html", value: pdfEmbedHtml(node.value.trim(), parseCodeTitle(node.meta ?? "")) };
			parent.children.splice(index, 1, html);
		});
	};
}
