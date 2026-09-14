"use client";

import { MERCHANT_KYB_MAX_DOCUMENT_COUNT } from "@workspace/shared";
import { Button } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

import { formatKybDocumentSize } from "./document-utils";
import type { MerchantKybPendingDocument } from "./pending-document";
import { validateMerchantKybFile } from "./pending-document";

function DocumentFileIcon({ className }: { readonly className?: string }): React.JSX.Element {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
			/>
		</svg>
	);
}

function UploadCloudIcon({ className }: { readonly className?: string }): React.JSX.Element {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
			<path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6h.1a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
		</svg>
	);
}

function RemoveIcon({ className }: { readonly className?: string }): React.JSX.Element {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
			<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
		</svg>
	);
}

interface CollectValidatedDocumentsResult {
	readonly added: readonly MerchantKybPendingDocument[];
	readonly error: string | null;
}

function collectValidatedDocuments(files: readonly File[], existingCount: number): CollectValidatedDocumentsResult {
	const remainingSlots = MERCHANT_KYB_MAX_DOCUMENT_COUNT - existingCount;
	if (remainingSlots <= 0) {
		return {
			added: [],
			error: `You can upload up to ${String(MERCHANT_KYB_MAX_DOCUMENT_COUNT)} documents.`,
		};
	}

	const selectedFiles = files.slice(0, remainingSlots);
	const added: MerchantKybPendingDocument[] = [];
	const errors: string[] = [];

	for (const file of selectedFiles) {
		try {
			added.push(validateMerchantKybFile(file));
		} catch (err) {
			const message = err instanceof Error ? err.message : "Unable to upload document.";
			if (!errors.includes(message)) {
				errors.push(message);
			}
		}
	}

	if (files.length > remainingSlots) {
		errors.push(`Only ${String(remainingSlots)} more document${remainingSlots === 1 ? "" : "s"} can be added.`);
	}

	if (added.length === 0 && errors.length > 0) {
		return { added: [], error: errors[0] ?? "Unable to upload documents." };
	}

	return {
		added,
		error: errors.length > 0 ? (errors[0] ?? null) : null,
	};
}

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
		<li className="flex items-center gap-3 rounded-lg bg-background/70 px-3 py-2.5 shadow-xs ring-1 ring-border/60">
			<div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground" aria-hidden="true">
				<DocumentFileIcon className="size-4" />
			</div>
			<div className="min-w-0 flex-1">
				{readOnly && onOpen !== undefined ? (
					<button type="button" className="truncate text-sm font-medium text-primary hover:underline" onClick={handleOpen}>
						{document.fileName}
					</button>
				) : (
					<p className="truncate text-sm font-medium text-foreground">{document.fileName}</p>
				)}
				<p className="text-xs text-muted-foreground">{formatKybDocumentSize(document.sizeBytes)}</p>
			</div>
			{readOnly ? null : (
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground"
					aria-label={`Remove ${document.fileName}`}
					onClick={handleRemove}>
					<RemoveIcon className="size-4" />
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
		const dragDepthRef = React.useRef(0);
		const [localError, setLocalError] = React.useState<string | null>(null);
		const [isDragging, setIsDragging] = React.useState(false);

		const canAddMore = documents.length < MERCHANT_KYB_MAX_DOCUMENT_COUNT;

		const appendFiles = React.useCallback(
			(files: readonly File[]): void => {
				if (files.length === 0 || !canAddMore) {
					return;
				}

				setLocalError(null);
				const result = collectValidatedDocuments(files, documents.length);
				if (result.added.length > 0) {
					onChange?.([...documents, ...result.added]);
				}
				if (result.error !== null) {
					setLocalError(result.error);
				}
			},
			[canAddMore, documents, onChange],
		);

		const handlePickFiles = React.useCallback((): void => {
			if (!canAddMore) {
				return;
			}
			inputRef.current?.click();
		}, [canAddMore]);

		const handleFilesSelected = React.useCallback(
			(event: React.ChangeEvent<HTMLInputElement>): void => {
				const fileList = event.target.files;
				if (fileList === null || fileList.length === 0) {
					return;
				}
				appendFiles(Array.from(fileList));
				event.target.value = "";
			},
			[appendFiles],
		);

		const handleRemoveDocument = React.useCallback(
			(index: number): void => {
				setLocalError(null);
				onChange?.(documents.filter((_, documentIndex) => documentIndex !== index));
			},
			[documents, onChange],
		);

		const handleDragEnter = React.useCallback(
			(event: React.DragEvent<HTMLDivElement>): void => {
				event.preventDefault();
				event.stopPropagation();
				if (!canAddMore) {
					return;
				}
				dragDepthRef.current += 1;
				setIsDragging(true);
			},
			[canAddMore],
		);

		const handleDragLeave = React.useCallback((event: React.DragEvent<HTMLDivElement>): void => {
			event.preventDefault();
			event.stopPropagation();
			dragDepthRef.current -= 1;
			if (dragDepthRef.current <= 0) {
				dragDepthRef.current = 0;
				setIsDragging(false);
			}
		}, []);

		const handleDragOver = React.useCallback((event: React.DragEvent<HTMLDivElement>): void => {
			event.preventDefault();
			event.stopPropagation();
		}, []);

		const handleDrop = React.useCallback(
			(event: React.DragEvent<HTMLDivElement>): void => {
				event.preventDefault();
				event.stopPropagation();
				dragDepthRef.current = 0;
				setIsDragging(false);
				appendFiles(Array.from(event.dataTransfer.files));
			},
			[appendFiles],
		);

		const handleDropZoneKeyDown = React.useCallback(
			(event: React.KeyboardEvent<HTMLDivElement>): void => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					handlePickFiles();
				}
			},
			[handlePickFiles],
		);

		const handleBrowseClick = React.useCallback(
			(event: React.MouseEvent<HTMLButtonElement>): void => {
				event.stopPropagation();
				handlePickFiles();
			},
			[handlePickFiles],
		);

		const defaultHelperText =
			helperText ?? `Add up to ${String(MERCHANT_KYB_MAX_DOCUMENT_COUNT)} documents (PDF, JPEG, PNG, or WebP). Drag and drop files here or browse to select multiple at once.`;

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
					<div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-4">
						{canAddMore ? (
							<div
								role="button"
								tabIndex={0}
								className={cn(
									"rounded-lg border border-dashed p-4 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
									isDragging ? "border-primary/60 bg-primary/5" : "border-border/70 bg-background/40 hover:bg-background/60",
								)}
								aria-label="Upload business registration documents"
								onClick={handlePickFiles}
								onKeyDown={handleDropZoneKeyDown}
								onDragEnter={handleDragEnter}
								onDragLeave={handleDragLeave}
								onDragOver={handleDragOver}
								onDrop={handleDrop}>
								<div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
									<div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
										<UploadCloudIcon className="size-5" />
									</div>
									<div className="min-w-0 flex-1 space-y-1">
										<p className="text-sm font-medium text-foreground">{isDragging ? "Drop files to upload" : "Drag and drop documents here"}</p>
										<p className="text-xs text-muted-foreground">{defaultHelperText}</p>
										<p className="text-xs font-medium text-muted-foreground">
											{String(documents.length)} of {String(MERCHANT_KYB_MAX_DOCUMENT_COUNT)} added
										</p>
									</div>
									<Button type="button" variant="outline" className="h-10 shrink-0" onClick={handleBrowseClick}>
										Browse files
									</Button>
								</div>
							</div>
						) : (
							<div className="rounded-lg border border-border/70 bg-background/40 px-4 py-3 text-sm text-muted-foreground">
								Maximum of {String(MERCHANT_KYB_MAX_DOCUMENT_COUNT)} documents reached. Remove a file to add another.
							</div>
						)}

						{documents.length > 0 ? (
							<ul className="mt-4 space-y-2 border-t border-border/60 pt-4">
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
							<p className="mt-4 border-t border-border/60 pt-4 text-sm text-muted-foreground">No documents added yet.</p>
						)}
					</div>
				)}

				{readOnly ? (
					documents.length > 0 ? (
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
						<p className="text-sm text-muted-foreground">No documents on file.</p>
					)
				) : null}

				{localError !== null ? <p className="text-sm text-destructive">{localError}</p> : null}
			</div>
		);
	}),
);

MerchantKybDocumentUpload.displayName = "MerchantKybDocumentUpload";
