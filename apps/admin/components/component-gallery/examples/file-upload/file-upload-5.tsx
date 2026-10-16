"use client";

import { Alert, AlertAction, AlertTitle } from "@workspace/ui/components/alert";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Progress } from "@workspace/ui/components/progress";
import { formatBytes, useFileUpload, type FileMetadata, type FileUploadOptions, type FileWithPreview } from "@workspace/ui/hooks/use-file-upload";
import { cn } from "@workspace/ui/lib/core/utils";
import { CircleAlertIcon, RefreshCwIcon, UploadIcon, XIcon } from "lucide-react";
import * as React from "react";

import {
	BYTES_PER_MEGABYTE,
	FAILED_SAMPLE_FILE_ID,
	FileActionButton,
	FileDropZone,
	FileKindIcon,
	FilePreviewImage,
	FileUploadErrors,
	SAMPLE_DOCUMENT_FILES,
	SAMPLE_TRANSFERS,
	fileIdsOf,
	isImageFile,
	sampleImageFiles,
	useSimulatedTransfers,
	type TransferState,
	type TransferStatus,
} from "@/components/component-gallery/examples/file-upload/file-upload-shared";

const MAX_FILES = 6;
/** Largest file accepted: 10 MB each. */
const MAX_FILE_BYTES = 10 * BYTES_PER_MEGABYTE;
/** Stored images the list starts with. */
const SAMPLE_IMAGE_COUNT = 2;
/** Intrinsic size of a row thumbnail, in pixels. */
const THUMBNAIL_SIZE_PX = 48;

/** Two stored images plus the sample document whose earlier attempt failed. */
const INITIAL_FILES: readonly FileMetadata[] = [
	...sampleImageFiles(SAMPLE_IMAGE_COUNT, "progress-sample"),
	...SAMPLE_DOCUMENT_FILES.filter((file: FileMetadata): boolean => file.id === FAILED_SAMPLE_FILE_ID),
];

function countWithStatus(files: readonly FileWithPreview[], transferOf: (fileId: string) => TransferState, status: TransferStatus): number {
	return files.filter((fileItem: FileWithPreview): boolean => transferOf(fileItem.id).status === status).length;
}

interface ProgressRowProps {
	readonly fileItem: FileWithPreview;
	readonly transfer: TransferState;
	readonly onRemove: (fileId: string) => void;
	readonly onRetry: (fileId: string) => void;
}

function ProgressRow({ fileItem, transfer, onRemove, onRetry }: ProgressRowProps): React.JSX.Element {
	const { file, preview } = fileItem;
	return (
		<div className="rounded-lg border border-border bg-card p-2.5">
			<div className="flex items-start gap-2.5">
				<div className="shrink-0">
					{preview !== undefined && isImageFile(file) ? (
						<FilePreviewImage src={preview} alt={file.name} width={THUMBNAIL_SIZE_PX} height={THUMBNAIL_SIZE_PX} className="size-12 rounded-lg border object-cover" />
					) : (
						<div className="flex size-12 items-center justify-center rounded-lg border border-border text-muted-foreground">
							<FileKindIcon file={file} />
						</div>
					)}
				</div>

				<div className="min-w-0 flex-1">
					<div className="mt-0.75 flex items-center justify-between">
						<p className="inline-flex flex-col justify-center gap-1 truncate font-medium">
							<span className="text-sm">{file.name}</span>
							<span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
						</p>
						<FileActionButton fileId={fileItem.id} onAction={onRemove} label={`Remove ${file.name}`} className="size-6 text-muted-foreground hover:bg-transparent">
							<XIcon className="size-4" />
						</FileActionButton>
					</div>

					{transfer.status === "uploading" ? <Progress value={transfer.progress} className="mt-2" aria-label={`${file.name} progress`} /> : null}

					{transfer.status === "error" ? (
						<Alert variant="destructive" className="mt-2 px-2 py-1">
							<CircleAlertIcon className="size-4" />
							<AlertTitle className="text-xs">Upload failed. Please try again.</AlertTitle>
							<AlertAction>
								<FileActionButton fileId={fileItem.id} onAction={onRetry} label={`Retry ${file.name}`} className="size-6 text-muted-foreground hover:bg-transparent">
									<RefreshCwIcon className="size-3.5" />
								</FileActionButton>
							</AlertAction>
						</Alert>
					) : null}
				</div>
			</div>
		</div>
	);
}

export function FileUpload5Example(): React.JSX.Element {
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

	const completedCount = countWithStatus(files, transferOf, "completed");
	const errorCount = countWithStatus(files, transferOf, "error");
	const uploadingCount = countWithStatus(files, transferOf, "uploading");

	return (
		<div className="w-full max-w-2xl">
			<FileDropZone
				actions={actions}
				className={cn(
					"relative rounded-lg border border-dashed p-8 text-center transition-colors",
					isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50",
				)}>
				<input {...getInputProps()} className="sr-only" aria-label="Files" tabIndex={-1} />

				<div className="flex flex-col items-center gap-4">
					<div className={cn("flex size-16 items-center justify-center rounded-full", isDragging ? "bg-primary/10" : "bg-muted")}>
						<UploadIcon className={cn("size-6", isDragging ? "text-primary" : "text-muted-foreground")} aria-hidden />
					</div>

					<div className="space-y-2">
						<h3 className="text-lg font-semibold">Upload your files</h3>
						<p className="text-sm text-muted-foreground">Drag and drop files here or click to browse</p>
						<p className="text-xs text-muted-foreground">Support for multiple file types up to {formatBytes(MAX_FILE_BYTES)} each</p>
					</div>

					<Button type="button" onClick={openFileDialog}>
						<UploadIcon className="size-4" />
						Select files
					</Button>
				</div>
			</FileDropZone>

			{files.length > 0 ? (
				<>
					<div className="mt-6 flex items-center justify-between">
						<div className="flex items-center gap-2">
							<h4 className="text-sm font-medium">Upload progress</h4>
							<div className="flex items-center gap-2">
								{completedCount > 0 ? (
									<Badge size="sm" variant="success-light">
										Completed: {completedCount}
									</Badge>
								) : null}
								{errorCount > 0 ? (
									<Badge size="sm" variant="destructive">
										Failed: {errorCount}
									</Badge>
								) : null}
								{uploadingCount > 0 ? (
									<Badge size="sm" variant="secondary">
										Uploading: {uploadingCount}
									</Badge>
								) : null}
							</div>
						</div>

						<Button type="button" onClick={clearFiles} variant="outline" size="sm">
							Clear all
						</Button>
					</div>

					<div className="mt-4 space-y-3">
						{files.map((fileItem: FileWithPreview): React.JSX.Element => (
							<ProgressRow key={fileItem.id} fileItem={fileItem} transfer={transferOf(fileItem.id)} onRemove={handleRemove} onRetry={retry} />
						))}
					</div>
				</>
			) : null}

			<FileUploadErrors errors={errors} />
		</div>
	);
}
