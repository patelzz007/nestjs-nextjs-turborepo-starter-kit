// What opens a PDF, draws its pages, finds text in it and saves a copy, as the
// viewer sees it. The native module's answers are parsed here (they cross from
// native code), and its error codes become the shared failure list every app
// words the same way (@workspace/shared `PdfOpenFailure`). Search and save are
// `null` where this device cannot do them (search needs Android 15), so the
// viewer hides their buttons instead of offering something that fails.

import type { PdfOpenFailure } from "@workspace/shared";
import type { PdfPageSize, PdfTextMatch } from "@workspace/ui-native/lib/pdf-viewer-layout";
import { z } from "zod";

import {
	loadPdfRendererModule,
	PdfDocumentInfoSchema,
	PdfRendererErrorCodeSchema,
	PdfSaveResultSchema,
	PdfSearchResultSchema,
	RenderedPageUriSchema,
	type PdfRendererErrorCode,
	type PdfRendererNativeModule,
} from "./pdf-renderer-module";

/** How opening a document went. */
export type PdfOpenResult = { readonly ok: true; readonly pages: readonly PdfPageSize[] } | { readonly ok: false; readonly failure: PdfOpenFailure };

/** How saving a copy went: saved under a name (a clash may have renamed it), the person cancelled (iOS), or it failed. */
export type PdfSaveOutcome = { readonly kind: "saved"; readonly fileName: string } | { readonly kind: "cancelled" } | { readonly kind: "failed" };

/** Finds `query` in the file: every match, in page order; rejects when the search cannot run. */
export type PdfSearch = (fileUri: string, query: string) => Promise<readonly PdfTextMatch[]>;

/** Saves a copy of the file under `fileName`; never rejects — a failure is an outcome. */
export type PdfSave = (fileUri: string, fileName: string) => Promise<PdfSaveOutcome>;

export interface PdfEngine {
	open(fileUri: string): Promise<PdfOpenResult>;
	/** Resolves with the rendered page's file address; rejects when the page cannot be drawn. */
	renderPage(fileUri: string, pageIndex: number, widthPx: number): Promise<string>;
	/** Text search; `null` where this device cannot search (Android before 15). */
	readonly search: PdfSearch | null;
	/** Saving a copy (Downloads on Android, "Save to Files" on iOS); `null` where this device cannot. */
	readonly save: PdfSave | null;
}

/** What each of the module's error codes means for the person. */
const FAILURE_OF_ERROR_CODE: Readonly<Record<PdfRendererErrorCode, PdfOpenFailure>> = {
	ERR_PDF_PASSWORD_PROTECTED: "password_protected",
	ERR_PDF_UNREADABLE: "unreadable",
	ERR_PDF_INVALID_REQUEST: "unreadable",
	ERR_PDF_RENDER_FAILED: "unreadable",
	// Search and save answer with these; opening a document never does.
	ERR_PDF_UNSUPPORTED: "unavailable",
	ERR_PDF_SAVE_FAILED: "unavailable",
};

/** A rejection from an Expo native module: an error carrying its code. */
const CodedErrorSchema = z.object({ code: z.string() });

/** The failure an error code means; a code the module does not name (or none) is a document it could not read. */
export function pdfOpenFailureOfErrorCode(code: string | null): PdfOpenFailure {
	const known = PdfRendererErrorCodeSchema.safeParse(code);
	return known.success ? FAILURE_OF_ERROR_CODE[known.data] : "unreadable";
}

/** The engine over the native module: answers parsed, rejections mapped to failures. */
export function createNativePdfEngine(module: PdfRendererNativeModule): PdfEngine {
	return {
		open: async (fileUri: string): Promise<PdfOpenResult> => {
			try {
				const info = PdfDocumentInfoSchema.safeParse(await module.openDocument(fileUri));
				return info.success ? { ok: true, pages: info.data.pages } : { ok: false, failure: "unreadable" };
			} catch (error: unknown) {
				return { ok: false, failure: pdfOpenFailureOfErrorCode(CodedErrorSchema.safeParse(error).data?.code ?? null) };
			}
		},
		renderPage: async (fileUri: string, pageIndex: number, widthPx: number): Promise<string> =>
			RenderedPageUriSchema.parse(await module.renderPage(fileUri, pageIndex, widthPx)),
		search: module.searchSupported
			? async (fileUri: string, query: string): Promise<readonly PdfTextMatch[]> => PdfSearchResultSchema.parse(await module.searchDocument(fileUri, query))
			: null,
		save: module.saveSupported
			? async (fileUri: string, fileName: string): Promise<PdfSaveOutcome> => {
					try {
						const result = PdfSaveResultSchema.safeParse(await module.saveDocument(fileUri, fileName));
						if (!result.success) {
							return { kind: "failed" };
						}
						return result.data.saved ? { kind: "saved", fileName: result.data.fileName } : { kind: "cancelled" };
					} catch {
						return { kind: "failed" };
					}
				}
			: null,
	};
}

/** This device's engine, or `null` in Expo Go (the module is not there): documents then open in another app. */
export function deviceNativePdfEngine(): PdfEngine | null {
	const module = loadPdfRendererModule();
	return module === null ? null : createNativePdfEngine(module);
}
