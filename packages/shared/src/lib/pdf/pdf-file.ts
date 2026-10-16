import { z } from "zod";

/** The media type every PDF is served, picked and shared as. */
export const PDF_MEDIA_TYPE = "application/pdf";

/** The file-name suffix of a PDF. */
export const PDF_FILE_EXTENSION = ".pdf";

/** The name a PDF is saved as when it has no usable name of its own. */
export const DEFAULT_PDF_FILE_NAME = `document${PDF_FILE_EXTENSION}`;

/** Every PDF starts with this header (ISO 32000-1 §7.5.2), e.g. `%PDF-1.7`. */
export const PDF_HEADER = "%PDF-";

/**
 * How far into a file the header is looked for. The standard puts it at byte 0, but
 * readers (Acrobat, PDFKit, PdfRenderer) accept it within the first KiB, so a file some
 * tool prefixed with junk still opens — and is accepted here for the same reason.
 */
export const PDF_HEADER_SEARCH_WINDOW_BYTES = 1024;

const BYTES_PER_MEBIBYTE = 1024 * 1024;
/** The largest PDF the viewers open (50 MiB): bigger files are offered as a download instead. */
export const MAX_PDF_VIEWER_FILE_BYTES = 50 * BYTES_PER_MEBIBYTE;

/**
 * Why a PDF could not be shown — one closed list shared by the web and native viewers,
 * so every app words the same failure the same way.
 * - `empty`: the file has no bytes.
 * - `too_large`: over the viewer's size limit.
 * - `not_a_pdf`: no `%PDF-` header — a renamed image, an HTML error page, …
 * - `password_protected`: the PDF is encrypted with a user password.
 * - `unreadable`: the platform's PDF engine rejected it (damaged file).
 * - `unavailable`: the file could not be fetched or read at all.
 */
export const PdfOpenFailureSchema = z.enum(["empty", "too_large", "not_a_pdf", "password_protected", "unreadable", "unavailable"]);

export type PdfOpenFailure = z.output<typeof PdfOpenFailureSchema>;

/** The outcome of checking a file before it is handed to a PDF engine. */
export type PdfFileCheck = { readonly ok: true } | { readonly ok: false; readonly failure: PdfOpenFailure };

export interface PdfFileFacts {
	/** The file's size in bytes. */
	readonly sizeBytes: number;
	/** At least the file's first {@link PDF_HEADER_SEARCH_WINDOW_BYTES} bytes (the whole file is fine). */
	readonly leadingBytes: Uint8Array;
}

/** The header's bytes; it is plain ASCII, so each character is one byte. */
const PDF_HEADER_BYTES: readonly number[] = Array.from(PDF_HEADER, (character: string): number => character.charCodeAt(0));

/** Whether the header sits at `offset` of `bytes`. */
function headerStartsAt(bytes: Uint8Array, offset: number): boolean {
	return PDF_HEADER_BYTES.every((headerByte: number, index: number): boolean => bytes.at(offset + index) === headerByte);
}

/** Whether `bytes` carry a PDF header within the search window. */
export function hasPdfHeader(bytes: Uint8Array): boolean {
	const lastStart = Math.min(bytes.length, PDF_HEADER_SEARCH_WINDOW_BYTES) - PDF_HEADER_BYTES.length;
	for (let offset = 0; offset <= lastStart; offset += 1) {
		if (headerStartsAt(bytes, offset)) {
			return true;
		}
	}
	return false;
}

/**
 * Checks a file the person picked (or the app downloaded) before a PDF engine sees it:
 * not empty, within `maxBytes`, and starting like a PDF. The engine still has the final
 * word — a file can pass here and be damaged further in (`unreadable`).
 */
export function checkPdfFile({ sizeBytes, leadingBytes }: PdfFileFacts, maxBytes: number = MAX_PDF_VIEWER_FILE_BYTES): PdfFileCheck {
	if (sizeBytes === 0) {
		return { ok: false, failure: "empty" };
	}
	if (sizeBytes > maxBytes) {
		return { ok: false, failure: "too_large" };
	}
	return hasPdfHeader(leadingBytes) ? { ok: true } : { ok: false, failure: "not_a_pdf" };
}

/** A path separator (either OS) — a name never carries a folder into a download. */
const PATH_SEPARATOR = /[\\/]/;
/** Characters Windows, macOS or Linux reject in a file name. */
const UNSAFE_FILE_NAME_CHARACTERS = /[<>:"|?*]/g;
/** Code points below this are control characters (C0), never kept in a name. */
const FIRST_PRINTABLE_CODE_POINT = 0x20;
/** Runs of whitespace, folded to one space. */
const WHITESPACE_RUN = /\s+/g;
/** A name that ends in `.pdf`, in any case. */
const PDF_SUFFIX = /\.pdf$/i;

/** `value` without control characters. */
function withoutControlCharacters(value: string): string {
	return Array.from(value)
		.filter((character: string): boolean => (character.codePointAt(0) ?? 0) >= FIRST_PRINTABLE_CODE_POINT)
		.join("");
}

/**
 * The name a PDF is saved or shared as: the last segment of `name`, without characters a
 * file system rejects, ending in `.pdf` — or {@link DEFAULT_PDF_FILE_NAME} when no name is
 * left (`"reports/Q3: summary"` → `"Q3 summary.pdf"`).
 */
export function pdfFileName(name: string): string {
	const lastSegment = name.split(PATH_SEPARATOR).at(-1) ?? "";
	const cleaned = withoutControlCharacters(lastSegment).replace(UNSAFE_FILE_NAME_CHARACTERS, "").replace(WHITESPACE_RUN, " ").trim();
	const stem = cleaned.replace(PDF_SUFFIX, "").trim();
	return stem.length === 0 ? DEFAULT_PDF_FILE_NAME : `${stem}${PDF_FILE_EXTENSION}`;
}
