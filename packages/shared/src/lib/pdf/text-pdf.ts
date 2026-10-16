import { PDF_HEADER } from "./pdf-file";

/**
 * Writes a small, valid PDF of plain text pages — for demos (the admin gallery, the docs
 * site's sample) and tests that need a real PDF without committing a binary file. It is not
 * a document generator: one built-in font (Helvetica, every reader has it), A4 pages, one
 * title and a few lines per page, ASCII text.
 */

export interface TextPdfPage {
	readonly title: string;
	readonly lines: readonly string[];
}

/** A4 in PDF points (1/72 inch). */
const A4_WIDTH_PT = 595;
const A4_HEIGHT_PT = 842;
const PAGE_MARGIN_PT = 72;
const TITLE_FONT_SIZE_PT = 20;
const BODY_FONT_SIZE_PT = 12;
/** Gap between the title's baseline and the first body line. */
const TITLE_GAP_PT = 36;
const BODY_LINE_HEIGHT_PT = 18;
/** Width of an `xref` byte offset (ISO 32000-1 §7.5.4: ten digits, zero-padded). */
const XREF_OFFSET_DIGITS = 10;
/** The objects before the pages: 1 catalog, 2 page tree, 3 font. */
const FIRST_PAGE_OBJECT_NUMBER = 4;
/** Each page is two objects: the page and its content stream. */
const OBJECTS_PER_PAGE = 2;
/** Highest code point written as-is; anything else becomes `?` (the font's encoding is Latin). */
const LAST_PRINTABLE_ASCII = 0x7e;
const FIRST_PRINTABLE_ASCII = 0x20;

/** Backslashes and parentheses are the only characters a PDF literal string escapes. */
const STRING_SPECIAL_CHARACTERS = /[\\()]/g;

/** `text` as a PDF literal string's contents: printable ASCII, with `\ ( )` escaped. */
function pdfStringText(text: string): string {
	const printable = Array.from(text, (character: string): string => {
		const codePoint = character.codePointAt(0) ?? 0;
		return codePoint >= FIRST_PRINTABLE_ASCII && codePoint <= LAST_PRINTABLE_ASCII ? character : "?";
	}).join("");
	return printable.replace(STRING_SPECIAL_CHARACTERS, (special: string): string => `\\${special}`);
}

/** The drawing operators of one page: the title, then each line below it. */
function pageContent(page: TextPdfPage): string {
	const titleBaseline = A4_HEIGHT_PT - PAGE_MARGIN_PT;
	const body = page.lines.map((line: string): string => `0 -${String(BODY_LINE_HEIGHT_PT)} Td (${pdfStringText(line)}) Tj`).join("\n");
	return [
		"BT",
		`/F1 ${String(TITLE_FONT_SIZE_PT)} Tf`,
		`${String(PAGE_MARGIN_PT)} ${String(titleBaseline)} Td`,
		`(${pdfStringText(page.title)}) Tj`,
		`/F1 ${String(BODY_FONT_SIZE_PT)} Tf`,
		`0 -${String(TITLE_GAP_PT - BODY_LINE_HEIGHT_PT)} Td`,
		body,
		"ET",
	].join("\n");
}

/** The PDF's bytes (all ASCII, so one character is one byte). At least one page is written. */
export function buildTextPdf(pages: readonly TextPdfPage[]): string {
	const written: readonly TextPdfPage[] = pages.length > 0 ? pages : [{ title: "", lines: [] }];
	const pageObjectNumbers = written.map((_page: TextPdfPage, index: number): number => FIRST_PAGE_OBJECT_NUMBER + index * OBJECTS_PER_PAGE);
	const kids = pageObjectNumbers.map((objectNumber: number): string => `${String(objectNumber)} 0 R`).join(" ");

	const bodies: string[] = [
		"<< /Type /Catalog /Pages 2 0 R >>",
		`<< /Type /Pages /Kids [${kids}] /Count ${String(written.length)} >>`,
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
	];
	for (const [index, page] of written.entries()) {
		const contentObjectNumber = (pageObjectNumbers.at(index) ?? 0) + 1;
		const content = pageContent(page);
		bodies.push(
			`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${String(A4_WIDTH_PT)} ${String(A4_HEIGHT_PT)}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${String(contentObjectNumber)} 0 R >>`,
			`<< /Length ${String(content.length)} >>\nstream\n${content}\nendstream`,
		);
	}

	let pdf = `${PDF_HEADER}1.4\n`;
	const offsets: number[] = [];
	for (const [index, body] of bodies.entries()) {
		offsets.push(pdf.length);
		pdf += `${String(index + 1)} 0 obj\n${body}\nendobj\n`;
	}
	const xrefOffset = pdf.length;
	const entries = offsets.map((offset: number): string => `${String(offset).padStart(XREF_OFFSET_DIGITS, "0")} 00000 n \n`).join("");
	pdf += `xref\n0 ${String(bodies.length + 1)}\n0000000000 65535 f \n${entries}`;
	pdf += `trailer\n<< /Size ${String(bodies.length + 1)} /Root 1 0 R >>\nstartxref\n${String(xrefOffset)}\n%%EOF\n`;
	return pdf;
}
