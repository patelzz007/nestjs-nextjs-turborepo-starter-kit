// ============================================
// The app's PDF engine — the local native module (modules/pdf-renderer, ADR 056)
// ============================================
// PDFKit on iOS, android.graphics.pdf.PdfRenderer on Android: the engines the
// operating systems ship, reached through the app's own Expo module, so no
// third-party PDF library is involved. Expo Go does not contain the module:
// there `loadPdfRendererModule()` is `null` and the viewer hands documents to
// another app instead (features/pdf-viewer/use-pdf-document.ts).
//
// Both functions are stateless: each call opens the file. A page is rendered
// to a PNG in the app's cache, once per page and width.

import { requireOptionalNativeModule } from "expo";
import { z } from "zod";

/** The name the module registers with Expo (`Name("PdfRenderer")` in Swift and Kotlin). */
export const PDF_RENDERER_MODULE_NAME = "PdfRenderer";

/** The codes the module rejects with (its Swift and Kotlin exceptions). */
export const PdfRendererErrorCodeSchema = z.enum(["ERR_PDF_PASSWORD_PROTECTED", "ERR_PDF_UNREADABLE", "ERR_PDF_INVALID_REQUEST", "ERR_PDF_RENDER_FAILED"]);

export type PdfRendererErrorCode = z.output<typeof PdfRendererErrorCodeSchema>;

/** One page's size in PDF points, turned by its rotation. */
const PdfPageSizeSchema = z.object({ width: z.number().positive(), height: z.number().positive() });

/** What `openDocument` answers: the page count and every page's size, in order. */
export const PdfDocumentInfoSchema = z
	.object({ pageCount: z.number().int().nonnegative(), pages: z.array(PdfPageSizeSchema) })
	.refine((info): boolean => info.pages.length === info.pageCount, { message: "pages must list every page" });

export type PdfDocumentInfo = z.output<typeof PdfDocumentInfoSchema>;

/** A rendered page's address: a file in the app's cache. */
export const RenderedPageUriSchema = z.string().startsWith("file://");

/** The module's JavaScript surface, as the native side declares it. Its answers are parsed, never trusted. */
export interface PdfRendererNativeModule {
	/** Every page's size; rejects with ERR_PDF_PASSWORD_PROTECTED or ERR_PDF_UNREADABLE. */
	openDocument(fileUri: string): Promise<z.input<typeof PdfDocumentInfoSchema>>;
	/** Page `pageIndex` (0-based) as a PNG `widthPx` wide; rejects as `openDocument` does, or with ERR_PDF_INVALID_REQUEST / ERR_PDF_RENDER_FAILED. */
	renderPage(fileUri: string, pageIndex: number, widthPx: number): Promise<string>;
}

/** The native module, or `null` where the app runs without it (Expo Go). */
export function loadPdfRendererModule(): PdfRendererNativeModule | null {
	return requireOptionalNativeModule<PdfRendererNativeModule>(PDF_RENDERER_MODULE_NAME);
}
