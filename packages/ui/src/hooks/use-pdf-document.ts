"use client";

import { checkPdfFile, PDF_HEADER_SEARCH_WINDOW_BYTES, PDF_MEDIA_TYPE, type PdfOpenFailure } from "@workspace/shared";
import * as React from "react";

/**
 * What a web `PdfViewer` shows:
 * - `url`: a PDF the app's own API signed (an object-storage URL served `inline`). It is
 *   not fetched by the page — the browser's PDF engine loads it in a frame, so the
 *   storage bucket needs no CORS rule for reads. `downloadUrl` is the same object served
 *   as an `attachment`, when the API offers one.
 * - `file`: a file the person picked on this device. It is checked locally (size and
 *   `%PDF-` header) and shown from a `blob:` URL; nothing is uploaded.
 */
export type PdfViewerSource =
	{ readonly kind: "url"; readonly url: string; readonly fileName: string; readonly downloadUrl?: string | undefined } | { readonly kind: "file"; readonly file: File };

/** Where an opened document is: being checked, ready for the PDF engine, or rejected. */
export type PdfDocumentState =
	| { readonly status: "idle" }
	| { readonly status: "checking"; readonly fileName: string }
	| { readonly status: "ready"; readonly fileName: string; readonly viewUrl: string; readonly downloadUrl: string }
	| { readonly status: "failed"; readonly fileName: string; readonly failure: PdfOpenFailure };

interface SettledFile {
	readonly file: File;
	readonly state: PdfDocumentState;
}

/** The picked file as a PDF blob: a file the OS typed oddly (`""`, `application/octet-stream`) still renders. */
function asPdfBlob(file: File): Blob {
	return file.type === PDF_MEDIA_TYPE ? file : new Blob([file], { type: PDF_MEDIA_TYPE });
}

/** Checks a picked file and, when it is a PDF, holds a `blob:` URL for it until the file changes or the viewer unmounts. */
function usePickedPdf(file: File | null): PdfDocumentState | null {
	const [settled, setSettled] = React.useState<SettledFile | null>(null);

	React.useEffect((): (() => void) | undefined => {
		if (file === null) {
			return undefined;
		}
		const cancelled: { current: boolean } = { current: false };
		const objectUrl: { current: string | null } = { current: null };
		void (async (): Promise<void> => {
			const state = await readPickedPdf(file);
			if (cancelled.current) {
				// The file changed (or the viewer closed) while it was being read.
				if (state.status === "ready") {
					URL.revokeObjectURL(state.viewUrl);
				}
				return;
			}
			if (state.status === "ready") {
				objectUrl.current = state.viewUrl;
			}
			setSettled({ file, state });
		})();
		return (): void => {
			cancelled.current = true;
			if (objectUrl.current !== null) {
				URL.revokeObjectURL(objectUrl.current);
			}
		};
	}, [file]);

	if (file === null) {
		return null;
	}
	return settled !== null && settled.file === file ? settled.state : { status: "checking", fileName: file.name };
}

/** The picked file's state once checked: a `blob:` URL for a PDF, the reason otherwise. */
async function readPickedPdf(file: File): Promise<PdfDocumentState> {
	try {
		const leadingBytes = new Uint8Array(await file.slice(0, PDF_HEADER_SEARCH_WINDOW_BYTES).arrayBuffer());
		const check = checkPdfFile({ sizeBytes: file.size, leadingBytes });
		if (!check.ok) {
			return { status: "failed", fileName: file.name, failure: check.failure };
		}
		const viewUrl = URL.createObjectURL(asPdfBlob(file));
		return { status: "ready", fileName: file.name, viewUrl, downloadUrl: viewUrl };
	} catch {
		// The browser could not read the file (it was moved, or permission was revoked).
		return { status: "failed", fileName: file.name, failure: "unavailable" };
	}
}

/** The state of the PDF a viewer shows, for a signed URL or a picked file (`null`: nothing open). */
export function usePdfDocument(source: PdfViewerSource | null): PdfDocumentState {
	const pickedFile = source?.kind === "file" ? source.file : null;
	const picked = usePickedPdf(pickedFile);
	if (source === null) {
		return { status: "idle" };
	}
	if (source.kind === "url") {
		return { status: "ready", fileName: source.fileName, viewUrl: source.url, downloadUrl: source.downloadUrl ?? source.url };
	}
	return picked ?? { status: "checking", fileName: source.file.name };
}
