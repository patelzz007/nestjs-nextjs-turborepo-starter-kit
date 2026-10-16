"use client";

import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { formatBytes, useFileUpload, type FileMetadata, type FileUploadOptions, type FileWithPreview } from "@workspace/ui/hooks/use-file-upload";
import { cn } from "@workspace/ui/lib/core/utils";
import { CloudUploadIcon, RefreshCwIcon, Trash2Icon, UploadIcon, XIcon } from "lucide-react";
import * as React from "react";

import {
	BYTES_PER_MEGABYTE,
	FileActionButton,
	FileDropZone,
	FileKindIcon,
	FilePreviewImage,
	FileUploadErrors,
	ProgressRing,
	SAMPLE_DOCUMENT_FILES,
	SAMPLE_TRANSFERS,
	fileIdsOf,
	isImageFile,
	sampleImageFiles,
	useSimulatedTransfers,
	type TransferState,
} from "@/components/component-gallery/examples/file-upload/file-upload-shared";

const MAX_FILES = 10;
/** Largest file accepted: 50 MB each. */
const MAX_FILE_BYTES = 50 * BYTES_PER_MEGABYTE;
/** Stored images the grid starts with, after the sample documents. */
const SAMPLE_IMAGE_COUNT = 2;
/** Intrinsic size of a card's square preview, in pixels. */
const PREVIEW_SIZE_PX = 200;

const INITIAL_FILES: readonly FileMetadata[] = [...SAMPLE_DOCUMENT_FILES, ...sampleImageFiles(SAMPLE_IMAGE_COUNT, "card-sample")];

interface FileCardProps {
	readonly fileItem: FileWithPreview;
	readonly transfer: TransferState;
	readonly onRemove: (fileId: string) => void;
	readonly onRetry: (fileId: string) => void;
}

function FileCard({ fileItem, transfer, onRemove, onRetry }: FileCardProps): React.JSX.Element {
	const { file, preview } = fileItem;
	const isUploading = transfer.status === "uploading";
	const progressLabel = `${file.name} progress`;

	const handleRetry = React.useCallback((): void => {
		onRetry(fileItem.id);
	}, [fileItem.id, onRetry]);

	return (
		<div className="group/item relative">
			<FileActionButton
				fileId={fileItem.id}
				onAction={onRemove}
				label={`Remove ${file.name}`}
				variant="outline"
				className="absolute -end-2 -top-2 z-10 size-6 rounded-full opacity-0 transition-opacity group-hover/item:opacity-100 focus-visible:opacity-100">
				<XIcon className="size-3.5" />
			</FileActionButton>

			<div className="relative overflow-hidden rounded-lg border bg-card transition-colors">
				<div className="relative aspect-square border-b border-border bg-muted">
					{isImageFile(file) && preview !== undefined ? (
						<>
							<FilePreviewImage src={preview} alt={file.name} width={PREVIEW_SIZE_PX} height={PREVIEW_SIZE_PX} className="size-full object-cover" />
							{isUploading ? (
								<div className="absolute inset-0 flex items-center justify-center bg-background/60">
									<ProgressRing progress={transfer.progress} label={progressLabel} indicatorClassName="text-foreground" trackClassName="text-muted/60" />
								</div>
							) : null}
						</>
					) : (
						<div className="flex h-full items-center justify-center text-muted-foreground/80">
							{isUploading ? (
								<ProgressRing progress={transfer.progress} label={progressLabel}>
									<FileKindIcon file={file} />
								</ProgressRing>
							) : (
								<FileKindIcon file={file} className="size-6" />
							)}
						</div>
					)}
				</div>

				<div className="p-3">
					<div className="space-y-1">
						<p className="truncate text-sm font-medium">{file.name}</p>
						<div className="relative flex items-center justify-between gap-2">
							<span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>

							{transfer.status === "error" ? (
								<Tooltip>
									<TooltipTrigger
										type="button"
										onClick={handleRetry}
										aria-label={`Retry ${file.name}`}
										className={buttonVariants({
											variant: "ghost",
											size: "icon",
											className: "absolute end-0 -top-1.25 size-6 text-destructive hover:bg-destructive/10 hover:text-destructive",
										})}>
										<RefreshCwIcon className="size-3" />
									</TooltipTrigger>
									<TooltipContent>Upload failed. Retry</TooltipContent>
								</Tooltip>
							) : null}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export function FileUpload9Example(): React.JSX.Element {
	const { start, retry, forget, transferOf } = useSimulatedTransfers(SAMPLE_TRANSFERS);

	const handleFilesAdded = React.useCallback(
		(added: readonly FileWithPreview[]): void => {
			start(fileIdsOf(added));
		},
		[start],
	);

	const uploadOptions = React.useMemo(
		(): FileUploadOptions => ({ maxFiles: MAX_FILES, maxSize: MAX_FILE_BYTES, multiple: true, initialFiles: INITIAL_FILES, onFilesAdded: handleFilesAdded }),
		[handleFilesAdded],
	);
	const [{ files, isDragging, errors }, actions] = useFileUpload(uploadOptions);
	const { removeFile, clearFiles, openFileDialog, getInputProps } = actions;

	const handleRemove = React.useCallback(
		(fileId: string): void => {
			removeFile(fileId);
			forget(fileId);
		},
		[forget, removeFile],
	);

	return (
		<div className="w-full space-y-4">
			<FileDropZone
				actions={actions}
				className={cn(
					"relative rounded-lg border border-dashed p-6 text-center transition-colors",
					isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50",
				)}>
				<input {...getInputProps()} className="sr-only" aria-label="Files" tabIndex={-1} />

				<div className="flex flex-col items-center gap-4">
					<div className={cn("flex size-12 items-center justify-center rounded-full bg-muted transition-colors", isDragging ? "bg-primary/10" : null)}>
						<UploadIcon className="size-5 text-muted-foreground" aria-hidden />
					</div>

					<div className="space-y-2">
						<p className="text-sm font-medium">
							Drop files here or{" "}
							<button type="button" onClick={openFileDialog} className="cursor-pointer text-primary underline-offset-4 hover:underline">
								browse files
							</button>
						</p>
						<p className="text-xs text-muted-foreground">
							Maximum file size: {formatBytes(MAX_FILE_BYTES)} • Maximum files: {MAX_FILES}
						</p>
					</div>
				</div>
			</FileDropZone>

			{files.length > 0 ? (
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<h3 className="text-sm font-medium">Files ({files.length})</h3>
						<div className="flex gap-2">
							<Button type="button" onClick={openFileDialog} variant="outline" size="sm">
								<CloudUploadIcon />
								Add files
							</Button>
							<Button type="button" onClick={clearFiles} variant="outline" size="sm">
								<Trash2Icon />
								Remove all
							</Button>
						</div>
					</div>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-4 lg:grid-cols-6">
						{files.map((fileItem: FileWithPreview): React.JSX.Element => (
							<FileCard key={fileItem.id} fileItem={fileItem} transfer={transferOf(fileItem.id)} onRemove={handleRemove} onRetry={retry} />
						))}
					</div>
				</div>
			) : null}

			<FileUploadErrors errors={errors} />
		</div>
	);
}
