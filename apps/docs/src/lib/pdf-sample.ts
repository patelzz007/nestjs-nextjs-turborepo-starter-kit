import { buildTextPdf, type TextPdfPage } from "@workspace/shared";

/**
 * The sample PDF the PDF viewer guide embeds, served at {@link PDF_SAMPLE_PATH} by
 * `src/pages/files/pdf-viewer-sample.pdf.ts`. Written at build time by the shared
 * `buildTextPdf`, so no binary file is committed.
 */
export const PDF_SAMPLE_PATH = "/files/pdf-viewer-sample.pdf";

const PDF_SAMPLE_PAGES: readonly TextPdfPage[] = [
	{
		title: "PDF viewer sample",
		lines: [
			"This page is drawn by your browser's built-in PDF engine.",
			"No PDF library is bundled with the docs or the apps.",
			"",
			"Use the header above to open it in a new tab or download it.",
		],
	},
	{ title: "Page two", lines: ["Scroll, zoom and search come from the browser's own viewer."] },
];

/** The sample's bytes. */
export function pdfSampleBytes(): Uint8Array<ArrayBuffer> {
	return new TextEncoder().encode(buildTextPdf(PDF_SAMPLE_PAGES));
}
