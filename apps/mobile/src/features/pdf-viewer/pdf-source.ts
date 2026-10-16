// Where the document the viewer shows comes from: a file the person picked
// on this phone, or an address another screen pushes (`?url=&name=`, e.g. a
// signed object-storage link). Route params arrive from the URL — a deep link
// included — so they are parsed before anything is downloaded.

import { DEFAULT_PDF_FILE_NAME } from "@workspace/shared";
import { z } from "zod";

import { ROUTES } from "../../runtime/routes";

export type PdfSource =
	{ readonly kind: "remote"; readonly url: string; readonly fileName: string } | { readonly kind: "picked"; readonly uri: string; readonly fileName: string };

/** Longest name shown in the viewer's header and used for the downloaded file. */
export const PDF_SOURCE_NAME_MAX_LENGTH = 200;

/** Only web addresses are downloaded: never `file:`, `content:` or a custom scheme a link could smuggle in. */
const WEB_PROTOCOL = /^https?$/;

/** `?url=&name=` of the viewer's route; `name` falls back to a generic file name. */
export const PdfViewerRouteParamsSchema = z.object({
	url: z.url({ protocol: WEB_PROTOCOL }),
	name: z.string().trim().min(1).max(PDF_SOURCE_NAME_MAX_LENGTH).optional().catch(undefined),
});

export type PdfViewerRouteParams = z.input<typeof PdfViewerRouteParamsSchema>;

/** The document a route's params name, or `null` when they name none (the viewer then waits for a pick). */
export function pdfSourceOfRouteParams(params: Readonly<Record<string, string | string[] | undefined>>): PdfSource | null {
	const parsed = PdfViewerRouteParamsSchema.safeParse(params);
	return parsed.success ? { kind: "remote", url: parsed.data.url, fileName: parsed.data.name ?? DEFAULT_PDF_FILE_NAME } : null;
}

/** Where another screen sends a document to be read: `router.push(pdfViewerHref(url, name))`. */
export function pdfViewerHref(url: string, name: string): { readonly pathname: typeof ROUTES.pdfViewer; readonly params: PdfViewerRouteParams } {
	return { pathname: ROUTES.pdfViewer, params: { url, name } };
}
