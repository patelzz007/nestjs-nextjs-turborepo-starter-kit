import { checkPdfFile } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { PDF_SAMPLE_PATH, pdfSampleBytes } from "../pdf-sample";
import { PdfEmbedUrlSchema } from "../markdown/pdf-embed";

describe("the PDF viewer guide's sample", () => {
	it("is a PDF the viewers accept", () => {
		const bytes = pdfSampleBytes();
		expect(checkPdfFile({ sizeBytes: bytes.length, leadingBytes: bytes })).toEqual({ ok: true });
	});

	it("is served at a path a pdf fence can embed", () => {
		expect(PdfEmbedUrlSchema.safeParse(PDF_SAMPLE_PATH).success).toBe(true);
		expect(PDF_SAMPLE_PATH).toBe("/files/pdf-viewer-sample.pdf");
	});
});
