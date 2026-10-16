import { describe, expect, it } from "vitest";

import {
	checkPdfFile,
	DEFAULT_PDF_FILE_NAME,
	hasPdfHeader,
	MAX_PDF_VIEWER_FILE_BYTES,
	PDF_HEADER,
	PDF_HEADER_SEARCH_WINDOW_BYTES,
	PdfOpenFailureSchema,
	pdfFileName,
} from "../pdf-file";

const encoder = new TextEncoder();

/** `text` as the bytes a file would hold. */
function bytesOf(text: string): Uint8Array {
	return encoder.encode(text);
}

/** `count` bytes of padding, then `text`. */
function paddedBytes(count: number, text: string): Uint8Array {
	return bytesOf(`${" ".repeat(count)}${text}`);
}

const PDF_START = bytesOf(`${PDF_HEADER}1.7\n%âãÏÓ\n`);

describe("hasPdfHeader", () => {
	it("finds the header at the start of the file", () => {
		expect(hasPdfHeader(PDF_START)).toBe(true);
	});

	it("finds a header that junk pushed further into the first KiB", () => {
		expect(hasPdfHeader(paddedBytes(PDF_HEADER_SEARCH_WINDOW_BYTES - PDF_HEADER.length, PDF_HEADER))).toBe(true);
	});

	it("ignores a header that starts past the search window", () => {
		expect(hasPdfHeader(paddedBytes(PDF_HEADER_SEARCH_WINDOW_BYTES - PDF_HEADER.length + 1, PDF_HEADER))).toBe(false);
	});

	it("rejects other files, a cut-off header and no bytes", () => {
		expect(hasPdfHeader(bytesOf("<!doctype html><title>Access denied</title>"))).toBe(false);
		expect(hasPdfHeader(bytesOf("%PDF"))).toBe(false);
		expect(hasPdfHeader(new Uint8Array())).toBe(false);
	});

	it("is case-sensitive, as the standard is", () => {
		expect(hasPdfHeader(bytesOf("%pdf-1.7"))).toBe(false);
	});
});

describe("checkPdfFile", () => {
	it("accepts a PDF within the limit", () => {
		expect(checkPdfFile({ sizeBytes: PDF_START.length, leadingBytes: PDF_START })).toEqual({ ok: true });
	});

	it("rejects an empty file before anything else", () => {
		expect(checkPdfFile({ sizeBytes: 0, leadingBytes: new Uint8Array() })).toEqual({ ok: false, failure: "empty" });
	});

	it("rejects a file over the default limit, and over a caller's own limit", () => {
		expect(checkPdfFile({ sizeBytes: MAX_PDF_VIEWER_FILE_BYTES + 1, leadingBytes: PDF_START })).toEqual({ ok: false, failure: "too_large" });
		expect(checkPdfFile({ sizeBytes: MAX_PDF_VIEWER_FILE_BYTES, leadingBytes: PDF_START })).toEqual({ ok: true });
		expect(checkPdfFile({ sizeBytes: PDF_START.length, leadingBytes: PDF_START }, PDF_START.length - 1)).toEqual({ ok: false, failure: "too_large" });
	});

	it("rejects a file without a PDF header", () => {
		const image = bytesOf("\u0089PNG\r\n");
		expect(checkPdfFile({ sizeBytes: image.length, leadingBytes: image })).toEqual({ ok: false, failure: "not_a_pdf" });
	});

	it("only ever reports a failure from the shared list", () => {
		const check = checkPdfFile({ sizeBytes: 1, leadingBytes: bytesOf("x") });
		expect(check.ok).toBe(false);
		expect(PdfOpenFailureSchema.options).toContain(check.ok ? null : check.failure);
	});
});

describe("pdfFileName", () => {
	it("keeps a name that already ends in .pdf, in any case", () => {
		expect(pdfFileName("Invoice 2026-10.pdf")).toBe("Invoice 2026-10.pdf");
		expect(pdfFileName("SCAN.PDF")).toBe("SCAN.pdf");
	});

	it("adds the suffix when it is missing", () => {
		expect(pdfFileName("Quarterly report")).toBe("Quarterly report.pdf");
	});

	it("drops folders, characters file systems reject and control characters", () => {
		expect(pdfFileName("reports/Q3: summary")).toBe("Q3 summary.pdf");
		expect(pdfFileName("C:\\Users\\me\\a<b>?.pdf")).toBe("ab.pdf");
		expect(pdfFileName("line\u0000\u001fbreak")).toBe("linebreak.pdf");
	});

	it("folds whitespace runs into one space", () => {
		expect(pdfFileName("  bank \t statement\n ")).toBe("bank statement.pdf");
	});

	it("falls back when no name is left", () => {
		expect(pdfFileName("")).toBe(DEFAULT_PDF_FILE_NAME);
		expect(pdfFileName(".pdf")).toBe(DEFAULT_PDF_FILE_NAME);
		expect(pdfFileName("folder/")).toBe(DEFAULT_PDF_FILE_NAME);
		expect(pdfFileName('***"')).toBe(DEFAULT_PDF_FILE_NAME);
	});
});
