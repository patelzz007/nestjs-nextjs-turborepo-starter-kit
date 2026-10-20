"use client";

import dynamic from "next/dynamic";
import * as React from "react";

import type { MerchantKybDocumentPreviewDialogProps } from "./document-preview-dialog";

function renderNothingWhileLoading(): null {
	return null;
}

const LazyMerchantKybDocumentPreviewDialog = dynamic(() => import("./document-preview-dialog").then((module) => module.MerchantKybDocumentPreviewDialog), {
	ssr: false,
	loading: renderNothingWhileLoading,
});

/**
 * The KYB document preview without the PDF viewer (pdf.js needs the browser's canvas and workers) in the
 * review page's first bundle: the chunk loads only when a document is opened (`preview` set). A closed
 * preview renders nothing — on the server too. Same props, same dialog.
 */
export default function MerchantKybDocumentPreviewDialogClientOnly(props: MerchantKybDocumentPreviewDialogProps): React.JSX.Element | null {
	return props.preview === null ? null : <LazyMerchantKybDocumentPreviewDialog {...props} />;
}
