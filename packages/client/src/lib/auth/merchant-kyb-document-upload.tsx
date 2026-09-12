"use client";

import { MERCHANT_KYB_MAX_DOCUMENT_COUNT } from "@workspace/shared";
import { Button } from "@workspace/ui/components/form/button";
import * as React from "react";

import { formatKybDocumentSize } from "./merchant-kyb-document-utils";
import type { MerchantKybPendingDocument } from "./merchant-kyb-pending-document";
import { validateMerchantKybFile } from "./merchant-kyb-pending-document";

interface MerchantKybDocumentListItemProps {
	readonly document: MerchantKybPendingDocument;
	readonly index: number;
	readonly onRemoveAtIndex?: (index: number) => void;
	readonly readOnly?: boolean;
	readonly onOpen?: (index: number) => void;
}

function MerchantKybDocumentListItem({ document, index, onRemoveAtIndex, readOnly = false, onOpen }: MerchantKybDocumentListItemProps): React.JSX.Element {
	const handleRemove = React.useCallback((): void => {
		onRemoveAtIndex?.(index);
	}, [index, onRemoveAtIndex]);

	const handleOpen = React.useCallback((): void => {
		onOpen?.(index);
	}, [index, onOpen]);

	return (
		<li className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
			<div className="min-w-0 flex-1">
				{readOnly && onOpen !== undefined ? (
					<button type="button" className="truncate text-sm font-medium text-primary hover:underline" onClick={handleOpen}>
						{document.fileName}
					</button>
				) : (
					<p className="truncate text-sm font-medium">{document.fileName}</p>
				)}
				<p className="text-xs text-muted-foreground">{formatKybDocumentSize(document.sizeBytes)}</p>
			</div>
			{readOnly ? null : (
				<Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${document.fileName}`} onClick={handleRemove}>
					Remove
				</Button>
			)}
		</li>
	);
}

export interface MerchantKybDocumentUploadProps {
	readonly documents: readonly MerchantKybPendingDocument[];
	readonly onChange?: (documents: MerchantKybPendingDocument[]) => void;
	readonly idPrefix?: string;
	readonly helperText?: string;
	readonly className?: string;
	readonly readOnly?: boolean;
	readonly onOpenDocument?: (index: number) => void;
}

export const MerchantKybDocumentUpload = React.memo(
	React.forwardRef<HTMLDivElement, MerchantKybDocumentUploadProps>(function MerchantKybDocumentUpload(
		{ documents, onChange, idPrefix = "merchant-kyb-documents", helperText, className, readOnly = false, onOpenDocument },
		ref,
	): React.JSX.Element {
		const inputRef = React.useRef<HTMLInputElement>(null);
		const [localError, setLocalError] = React.useState<string | null>(null);

		const handlePickFiles = React.useCallback((): void => {
			inputRef.current?.click();
		}, []);

		const handleFilesSelected = React.useCallback(
			(event: React.ChangeEvent<HTMLInputElement>): void => {
				setLocalError(null);
				const fileList = event.target.files;
				if (fileList === null || fileList.length === 0) {
					return;
				}

				const remainingSlots = MERCHANT_KYB_MAX_DOCUMENT_COUNT - documents.length;
				if (remainingSlots <= 0) {
					setLocalError(`You can upload up to ${String(MERCHANT_KYB_MAX_DOCUMENT_COUNT)} documents.`);
					event.target.value = "";
					return;
				}

				const selectedFiles = Array.from(fileList).slice(0, remainingSlots);
				try {
					const uploaded = selectedFiles.map((file) => validateMerchantKybFile(file));
					onChange?.([...documents, ...uploaded]);
					event.target.value = "";
				} catch (err) {
					const message = err instanceof Error ? err.message : "Unable to upload document.";
					setLocalError(message);
					event.target.value = "";
				}
			},
			[documents, onChange],
		);

		const handleRemoveDocument = React.useCallback(
			(index: number): void => {
				onChange?.(documents.filter((_, documentIndex) => documentIndex !== index));
			},
			[documents, onChange],
		);

		const canAddMore = documents.length < MERCHANT_KYB_MAX_DOCUMENT_COUNT;

		return (
			<div ref={ref} className={className !== undefined ? `space-y-4 ${className}` : "space-y-4"}>
				{readOnly ? null : (
					<input
						ref={inputRef}
						id={`${idPrefix}-input`}
						type="file"
						accept="application/pdf,image/jpeg,image/png,image/webp"
						multiple
						className="sr-only"
						onChange={handleFilesSelected}
					/>
				)}

				{readOnly ? (
					<p className="text-sm font-medium">Business registration documents</p>
				) : (
					<div className="rounded-xl border border-dashed bg-muted/20 p-4">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div className="space-y-1">
								<p className="text-sm font-medium">Business registration documents</p>
								<p className="text-xs text-muted-foreground">
									{helperText ?? "Upload your SSM certificate, tax registration, or other supporting documents (PDF, JPEG, PNG, or WebP)."}
								</p>
							</div>
							<Button type="button" variant="outline" className="h-10 shrink-0" disabled={!canAddMore} onClick={handlePickFiles}>
								Add documents
							</Button>
						</div>
					</div>
				)}

				{documents.length > 0 ? (
					<ul className="space-y-2">
						{documents.map((document, index) => (
							<MerchantKybDocumentListItem
								key={`${document.fileName}-${String(document.sizeBytes)}-${String(index)}`}
								document={document}
								index={index}
								onRemoveAtIndex={handleRemoveDocument}
								readOnly={readOnly}
								onOpen={onOpenDocument}
							/>
						))}
					</ul>
				) : (
					<p className="text-sm text-muted-foreground">{readOnly ? "No documents on file." : "No documents added yet."}</p>
				)}

				{localError !== null ? <p className="text-sm text-destructive">{localError}</p> : null}
			</div>
		);
	}),
);

MerchantKybDocumentUpload.displayName = "MerchantKybDocumentUpload";
