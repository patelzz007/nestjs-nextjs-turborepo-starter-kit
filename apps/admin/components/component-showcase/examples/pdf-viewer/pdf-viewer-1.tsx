"use client";

import * as React from "react";
import { PdfViewer, type PdfViewerSource } from "@workspace/ui/components/pdf-viewer";
import { buildTextPdf, PDF_MEDIA_TYPE } from "@workspace/shared";

/** A one-page sample statement, written in memory (no file is shipped or fetched). */
const SAMPLE_PAGES: Parameters<typeof buildTextPdf>[0] = [
	{
		title: "Monthly statement",
		lines: ["Acme Rewards - October 2026", "", "Opening balance          1,240 pts", "Earned                     380 pts", "Closing balance          1,620 pts"],
	},
];

function samplePdf(): PdfViewerSource {
	return { kind: "file", file: new File([buildTextPdf(SAMPLE_PAGES)], "sample-statement.pdf", { type: PDF_MEDIA_TYPE }) };
}

export function PdfViewer1Example(): React.JSX.Element {
	const [source, setSource] = React.useState<PdfViewerSource>(samplePdf);
	return <PdfViewer source={source} onSourceChange={setSource} className="h-[480px] w-full" />;
}
