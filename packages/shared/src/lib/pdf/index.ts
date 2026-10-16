/**
 * PDF file rules shared by every viewer — the web kit's `PdfViewer`, the native kit's
 * `PdfViewer` and the docs site. Pure TypeScript with no DOM, Node or native API; the
 * pages themselves are drawn by each platform's own PDF engine
 * (docs/technical/frontend/pdf-viewer.md).
 */
export {
	checkPdfFile,
	DEFAULT_PDF_FILE_NAME,
	hasPdfHeader,
	MAX_PDF_VIEWER_FILE_BYTES,
	PDF_FILE_EXTENSION,
	PDF_HEADER,
	PDF_HEADER_SEARCH_WINDOW_BYTES,
	PDF_MEDIA_TYPE,
	PdfOpenFailureSchema,
	pdfFileName,
	type PdfFileCheck,
	type PdfFileFacts,
	type PdfOpenFailure,
} from "./pdf-file";
export { buildTextPdf, type TextPdfPage } from "./text-pdf";
