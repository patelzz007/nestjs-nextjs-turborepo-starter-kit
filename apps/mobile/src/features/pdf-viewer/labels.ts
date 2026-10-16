// Copy of the PDF viewer (features/pdf-viewer). The viewer's own words
// (toolbar, failures) are the kit's defaults (@workspace/ui-native PdfViewer).

export const PDF_VIEWER_TITLE = "PDF viewer";

export const PDF_VIEWER_COPY = {
	description: "Open a PDF from your phone and read it here. Pages are drawn by your phone's own PDF engine.",
	chooseTitle: "Open a PDF",
	chooseDescription: "Pick a PDF from Files, Downloads or a cloud drive.",
	choose: "Choose a PDF",
	close: "Close document",
	sample: "Open a sample PDF",
	sampleFailed: "The sample couldn't be written. Check your phone's free space.",
	pickFailed: "That file couldn't be opened. Try another one.",
	openExternallyFailed: "No app could open this document.",
	invalidLink: "This link doesn't point to a document. Go back and open it again.",
} satisfies Record<string, string>;
