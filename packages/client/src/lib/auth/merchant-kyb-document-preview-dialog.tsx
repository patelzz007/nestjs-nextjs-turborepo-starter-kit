"use client";

import type { DocumentMimeType } from "@workspace/shared";
import { Button } from "@workspace/ui/components/form/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/overlay/dialog";
import * as React from "react";

import { isKybDocumentPreviewable, openExternalDocument, triggerBrowserDownload } from "./merchant-kyb-document-utils";

export interface MerchantKybDocumentPreviewState {
	readonly fileName: string;
	readonly mimeType: DocumentMimeType;
	readonly viewUrl: string;
	readonly downloadUrl: string;
}

export interface MerchantKybDocumentPreviewDialogProps {
	readonly preview: MerchantKybDocumentPreviewState | null;
	readonly onClose: () => void;
}

export function MerchantKybDocumentPreviewDialog({ preview, onClose }: MerchantKybDocumentPreviewDialogProps): React.JSX.Element {
	const open = preview !== null;

	const handleDownload = React.useCallback((): void => {
		if (preview === null) {
			return;
		}
		triggerBrowserDownload(preview.downloadUrl, preview.fileName);
	}, [preview]);

	const handleViewSource = React.useCallback((): void => {
		if (preview === null) {
			return;
		}
		openExternalDocument(preview.viewUrl);
	}, [preview]);

	const handleOpenChange = React.useCallback(
		(nextOpen: boolean): void => {
			if (!nextOpen) {
				onClose();
			}
		},
		[onClose],
	);

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="flex max-h-[min(90vh,900px)] w-full max-w-4xl flex-col gap-4 sm:max-w-4xl">
				<DialogHeader>
					<DialogTitle className="truncate pe-8">{preview?.fileName ?? "Document preview"}</DialogTitle>
				</DialogHeader>
				{preview !== null ? (
					<div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-muted/30">
						{isKybDocumentPreviewable(preview.mimeType) ? (
							preview.mimeType === "application/pdf" ? (
								<iframe title={preview.fileName} src={preview.viewUrl} className="h-[min(70vh,720px)] w-full bg-background" />
							) : (
								<div className="flex h-[min(70vh,720px)] w-full items-center justify-center overflow-auto p-4">
									<img src={preview.viewUrl} alt={preview.fileName} className="max-h-full max-w-full object-contain" />
								</div>
							)
						) : (
							<div className="flex h-48 items-center justify-center p-6 text-center text-sm text-muted-foreground">
								Preview is not available for this file type. Use download instead.
							</div>
						)}
					</div>
				) : null}
				<DialogFooter className="gap-2 sm:gap-0">
					<Button type="button" variant="outline" onClick={onClose}>
						Close
					</Button>
					{preview !== null ? (
						<>
							<Button type="button" variant="outline" onClick={handleViewSource}>
								View source
							</Button>
							<Button type="button" onClick={handleDownload}>
								Download
							</Button>
						</>
					) : null}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
