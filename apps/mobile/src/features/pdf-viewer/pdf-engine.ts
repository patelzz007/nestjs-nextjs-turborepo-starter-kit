// What opens a PDF and draws its pages, as the viewer sees it. The native
// module's answers are parsed here (they cross from native code), and its
// error codes become the shared failure list every app words the same way
// (@workspace/shared `PdfOpenFailure`).

import type { PdfOpenFailure } from "@workspace/shared";
import type { PdfPageSize } from "@workspace/ui-native/lib/pdf-viewer-layout";
import { z } from "zod";

import {
	loadPdfRendererModule,
	PdfDocumentInfoSchema,
	PdfRendererErrorCodeSchema,
	RenderedPageUriSchema,
	type PdfRendererErrorCode,
	type PdfRendererNativeModule,
} from "./pdf-renderer-module";

/** How opening a document went. */
export type PdfOpenResult = { readonly ok: true; readonly pages: readonly PdfPageSize[] } | { readonly ok: false; readonly failure: PdfOpenFailure };

export interface PdfEngine {
	open(fileUri: string): Promise<PdfOpenResult>;
	/** Resolves with the rendered page's file address; rejects when the page cannot be drawn. */
	renderPage(fileUri: string, pageIndex: number, widthPx: number): Promise<string>;
}

/** What each of the module's error codes means for the person. */
const FAILURE_OF_ERROR_CODE: Readonly<Record<PdfRendererErrorCode, PdfOpenFailure>> = {
	ERR_PDF_PASSWORD_PROTECTED: "password_protected",
	ERR_PDF_UNREADABLE: "unreadable",
	ERR_PDF_INVALID_REQUEST: "unreadable",
	ERR_PDF_RENDER_FAILED: "unreadable",
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
	};
}

/** This device's engine, or `null` in Expo Go (the module is not there): documents then open in another app. */
export function deviceNativePdfEngine(): PdfEngine | null {
	const module = loadPdfRendererModule();
	return module === null ? null : createNativePdfEngine(module);
}
