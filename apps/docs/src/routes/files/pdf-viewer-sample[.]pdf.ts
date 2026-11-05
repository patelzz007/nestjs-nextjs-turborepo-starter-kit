import { createFileRoute } from "@tanstack/react-router";
import { PDF_MEDIA_TYPE } from "@workspace/shared";

import { pdfSampleBytes } from "../../lib/pdf-sample";

/** The PDF viewer guide's sample (`src/lib/pdf-sample.ts`), written at build time. */
export const Route = createFileRoute("/files/pdf-viewer-sample.pdf")({
	server: {
		handlers: {
			GET: (): Response => new Response(pdfSampleBytes(), { headers: { "Content-Type": PDF_MEDIA_TYPE } }),
		},
	},
});
