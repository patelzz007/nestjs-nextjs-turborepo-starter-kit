import { hasGlobalValue } from "@workspace/shared";
import { z } from "zod";

/** `navigator.pdfViewerEnabled` (HTML standard): whether the browser shows PDFs inline. */
const PdfViewerEnabledSchema = z.boolean();

/**
 * Whether this browser draws PDFs inside the page. `false` on Android Chrome and wherever
 * the person turned the built-in viewer off (the browser downloads the file instead).
 * A browser too old to report it is assumed to support it — every desktop browser does.
 * Plain function (no React), so the docs site's scripts use it too.
 */
export function readPdfInlineSupport(): boolean {
	if (!hasGlobalValue("navigator")) {
		return true;
	}
	const reported = PdfViewerEnabledSchema.safeParse(Reflect.get(navigator, "pdfViewerEnabled"));
	return reported.success ? reported.data : true;
}
