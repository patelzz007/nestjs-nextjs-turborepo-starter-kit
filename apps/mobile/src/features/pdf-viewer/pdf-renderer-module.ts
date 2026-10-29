// ============================================
// The app's PDF engine — the local native module (modules/pdf-renderer, ADR 056)
// ============================================
// PDFKit on iOS, android.graphics.pdf.PdfRenderer on Android: the engines the
// operating systems ship, reached through the app's own Expo module, so no
// third-party PDF library is involved. Expo Go does not contain the module:
// there `loadPdfRendererModule()` is `null` and the viewer hands documents to
// another app instead (features/pdf-viewer/use-pdf-document.ts).
//
// Every function is stateless: each call opens the file. A page is rendered
// to a PNG in the app's cache, once per page and width. Search answers each
// match's boxes as fractions of the page, so the viewer can draw them at any
// zoom. Saving puts a copy where the person keeps files: Downloads on Android,
// a place they pick in "Save to Files" on iOS. `searchSupported` /
// `saveSupported` say whether this device can (search needs Android 15).

import { requireOptionalNativeModule } from "expo";
import { z } from "zod";

/** The name the module registers with Expo (`Name("PdfRenderer")` in Swift and Kotlin). */
export const PDF_RENDERER_MODULE_NAME = "PdfRenderer";

/** The codes the module rejects with (its Swift and Kotlin exceptions). */
export const PdfRendererErrorCodeSchema = z.enum([
	"ERR_PDF_PASSWORD_PROTECTED",
	"ERR_PDF_UNREADABLE",
	"ERR_PDF_INVALID_REQUEST",
	"ERR_PDF_RENDER_FAILED",
	"ERR_PDF_UNSUPPORTED",
	"ERR_PDF_SAVE_FAILED",
]);

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

/** A fraction of the page (0 at its left / top edge, 1 at its right / bottom edge); a little outside is clamped later. Zod 4 numbers are finite. */
const PageFractionSchema = z.number();

/** One box of a match, as fractions of the page as it is shown (top-left origin). */
export const PdfTextBoxSchema = z.object({
	left: PageFractionSchema,
	top: PageFractionSchema,
	width: PageFractionSchema.nonnegative(),
	height: PageFractionSchema.nonnegative(),
});

/** One match of a search: the page it is on and its boxes (one per line it spans). */
export const PdfTextMatchSchema = z.object({ pageIndex: z.number().int().nonnegative(), rects: z.array(PdfTextBoxSchema) });

/** What `searchDocument` answers: every match, in page order. */
export const PdfSearchResultSchema = z.array(PdfTextMatchSchema);

/** What `saveDocument` answers: whether a copy was saved (iOS: `false` when the person cancelled) and under which name. */
export const PdfSaveResultSchema = z.object({ saved: z.boolean(), fileName: z.string().min(1) });

/** The module's JavaScript surface, as the native side declares it. Its answers are parsed, never trusted. */
export interface PdfRendererNativeModule {
	/** Whether `searchDocument` works on this device (Android 15 and later, every iOS). */
	readonly searchSupported: boolean;
	/** Whether `saveDocument` works on this device (Android 10 and later, every iOS). */
	readonly saveSupported: boolean;
	/** Every page's size; rejects with ERR_PDF_PASSWORD_PROTECTED or ERR_PDF_UNREADABLE. */
	openDocument(fileUri: string): Promise<z.input<typeof PdfDocumentInfoSchema>>;
	/** Page `pageIndex` (0-based) as a PNG `widthPx` wide; rejects as `openDocument` does, or with ERR_PDF_INVALID_REQUEST / ERR_PDF_RENDER_FAILED. */
	renderPage(fileUri: string, pageIndex: number, widthPx: number): Promise<string>;
	/** Every match of `query` (case-insensitive), in page order; rejects as `openDocument` does, or with ERR_PDF_UNSUPPORTED. */
	searchDocument(fileUri: string, query: string): Promise<z.input<typeof PdfSearchResultSchema>>;
	/** Saves a copy named `fileName`; rejects with ERR_PDF_SAVE_FAILED or ERR_PDF_UNSUPPORTED. */
	saveDocument(fileUri: string, fileName: string): Promise<z.input<typeof PdfSaveResultSchema>>;
}

/** The native module, or `null` where the app runs without it (Expo Go). */
export function loadPdfRendererModule(): PdfRendererNativeModule | null {
	return requireOptionalNativeModule<PdfRendererNativeModule>(PDF_RENDERER_MODULE_NAME);
}
