// The files behind the viewer: a picked PDF (expo-document-picker copies it
// into the app's cache), a downloaded one (expo-file-system), the check every
// file passes before an engine sees it (@workspace/shared `checkPdfFile`:
// not empty, within the size limit, starting with `%PDF-`), and handing a
// file to another app (expo-sharing — "Open in…" on iOS, the app chooser on
// Android). All four are first-party Expo modules that Expo Go includes.

import { buildTextPdf, checkPdfFile, PDF_HEADER_SEARCH_WINDOW_BYTES, PDF_MEDIA_TYPE, pdfFileName, type PdfFileCheck } from "@workspace/shared";
import { randomUUID } from "expo-crypto";
import { getDocumentAsync } from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
import { shareAsync } from "expo-sharing";
import { z } from "zod";

import type { PdfSource } from "./pdf-source";

/** The cache folder downloaded documents are kept in (the OS may empty it). */
export const PDF_DOWNLOADS_FOLDER = "pdf-documents";

/** The Uniform Type Identifier of a PDF, for iOS's share sheet. */
export const PDF_UTI = "com.adobe.pdf";

/**
 * Downloads `url` into its own cache folder under the document's name, so
 * "Open in…" offers a file called what the person expects. Rejects when the
 * address cannot be fetched.
 */
export async function downloadPdf(url: string, fileName: string): Promise<string> {
	const folder = new Directory(Paths.cache, PDF_DOWNLOADS_FOLDER, randomUUID());
	folder.create({ intermediates: true, idempotent: true });
	const file = await File.downloadFileAsync(url, new File(folder, pdfFileName(fileName)));
	return file.uri;
}

/** Checks the file at `uri` without reading more than its first KiB into JavaScript. */
export function checkLocalPdf(uri: string): PdfFileCheck {
	const file = new File(uri);
	const sizeBytes = file.size;
	const handle = file.open();
	try {
		return checkPdfFile({ sizeBytes, leadingBytes: handle.readBytes(Math.min(sizeBytes, PDF_HEADER_SEARCH_WINDOW_BYTES)) });
	} finally {
		handle.close();
	}
}

/** What the picker answers when a file was chosen (one, since `multiple` is off). */
const PickedDocumentSchema = z.object({
	canceled: z.literal(false),
	assets: z.array(z.object({ uri: z.string().min(1), name: z.string() })).min(1),
});

/** Asks the person for a PDF; `null` when they back out. */
export async function pickPdf(): Promise<PdfSource | null> {
	const picked = PickedDocumentSchema.safeParse(await getDocumentAsync({ type: PDF_MEDIA_TYPE, copyToCacheDirectory: true, multiple: false }));
	if (!picked.success) {
		return null;
	}
	const [asset] = picked.data.assets;
	return asset === undefined ? null : { kind: "picked", uri: asset.uri, fileName: asset.name };
}

/** The sample document's name and pages: a quick way to see the viewer work without a PDF on the phone. */
export const SAMPLE_PDF_NAME = "Sample document.pdf";

const SAMPLE_PDF_PAGES = [
	{ title: "PDF viewer", lines: ["This document was written by the app itself.", "Its pages are drawn by your phone's own PDF engine.", "Scroll down for the next page."] },
	{ title: "Page and zoom", lines: ["Use the arrows to move a page at a time.", "Zoom in for small print; zoomed in, the page also scrolls sideways."] },
	{ title: "Open in another app", lines: ["The share button hands the document to another app:", "Files, Books, a cloud drive or any PDF reader."] },
];

/** Writes the sample document into the cache and names it as a picked file. */
export function writeSamplePdf(): PdfSource {
	const file = new File(Paths.cache, PDF_DOWNLOADS_FOLDER, SAMPLE_PDF_NAME);
	file.create({ intermediates: true, overwrite: true });
	file.write(buildTextPdf(SAMPLE_PDF_PAGES));
	return { kind: "picked", uri: file.uri, fileName: SAMPLE_PDF_NAME };
}

/** Hands the file to another app: the share sheet with "Open in…" / the Android app chooser. */
export async function sharePdf(uri: string, fileName: string): Promise<void> {
	await shareAsync(uri, { mimeType: PDF_MEDIA_TYPE, UTI: PDF_UTI, dialogTitle: fileName });
}
