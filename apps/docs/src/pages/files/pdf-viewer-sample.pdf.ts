import { PDF_MEDIA_TYPE } from "@workspace/shared";
import type { APIRoute } from "astro";

import { pdfSampleBytes } from "@/lib/pdf-sample";

/** The PDF viewer guide's sample (src/lib/pdf-sample.ts), written at build time. */
export const GET: APIRoute = () => new Response(pdfSampleBytes(), { headers: { "Content-Type": PDF_MEDIA_TYPE } });
