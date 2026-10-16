import { describe, expect, it } from "vitest";

import { checkPdfFile } from "../pdf-file";
import { buildTextPdf } from "../text-pdf";

const encoder = new TextEncoder();

/** Matches one cross-reference entry for an object in use. */
const XREF_ENTRY = /^(?<offset>\d{10}) 00000 n $/gm;
/** The offset after `startxref`. */
const START_XREF = /startxref\n(?<offset>\d+)\n%%EOF\n$/;
/** The page count in the page tree. */
const PAGE_COUNT = /\/Count (?<count>\d+)/;

function xrefOffsets(pdf: string): number[] {
	return [...pdf.matchAll(XREF_ENTRY)].map((match): number => Number(match.groups?.offset));
}

describe("buildTextPdf", () => {
	const pdf = buildTextPdf([
		{ title: "Statement", lines: ["Opening balance 120.00", "Closing balance 80.00"] },
		{ title: "Notes", lines: ["Page two"] },
	]);

	it("passes the viewers' own PDF check", () => {
		const bytes = encoder.encode(pdf);
		expect(checkPdfFile({ sizeBytes: bytes.length, leadingBytes: bytes })).toEqual({ ok: true });
	});

	it("writes ASCII only, so each character is one byte and the offsets are byte offsets", () => {
		expect(encoder.encode(pdf).length).toBe(pdf.length);
	});

	it("points every cross-reference entry at its object", () => {
		const offsets = xrefOffsets(pdf);
		expect(offsets).toHaveLength(7);
		for (const [index, offset] of offsets.entries()) {
			expect(pdf.startsWith(`${String(index + 1)} 0 obj\n`, offset)).toBe(true);
		}
	});

	it("points startxref at the cross-reference table", () => {
		const offset = Number(START_XREF.exec(pdf)?.groups?.offset);
		expect(pdf.startsWith("xref\n", offset)).toBe(true);
	});

	it("declares each content stream's exact length", () => {
		for (const match of pdf.matchAll(/<< \/Length (?<length>\d+) >>\nstream\n/g)) {
			const [header] = match;
			const start = match.index + header.length;
			const end = pdf.indexOf("\nendstream", start);
			expect(end - start).toBe(Number(match.groups?.length));
		}
	});

	it("counts its pages and draws each title and line", () => {
		expect(PAGE_COUNT.exec(pdf)?.groups?.count).toBe("2");
		expect(pdf).toContain("(Statement) Tj");
		expect(pdf).toContain("(Closing balance 80.00) Tj");
		expect(pdf).toContain("(Page two) Tj");
	});

	it("escapes the characters a PDF string reserves and replaces what the font cannot draw", () => {
		const escaped = buildTextPdf([{ title: "Fees (net) \\ total", lines: ["Café — 5€"] }]);
		expect(escaped).toContain("(Fees \\(net\\) \\\\ total) Tj");
		expect(escaped).toContain("(Caf? ? 5?) Tj");
	});

	it("always writes at least one page", () => {
		expect(PAGE_COUNT.exec(buildTextPdf([]))?.groups?.count).toBe("1");
	});
});
