"use client";

import { Badge } from "@workspace/ui/components/badge";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import { formatBytes, useFileUpload, type FileUploadOptions, type FileWithPreview } from "@workspace/ui/hooks/use-file-upload";
import { cn } from "@workspace/ui/lib/core/utils";
import { CloudUploadIcon, DownloadIcon, RefreshCwIcon, Trash2Icon, UploadIcon } from "lucide-react";
import * as React from "react";

import {
	BYTES_PER_MEGABYTE,
	FileActionButton,
	FileDropZone,
	FileKindIcon,
	FileUploadErrors,
	ProgressRing,
	SAMPLE_DOCUMENT_FILES,
	SAMPLE_TRANSFERS,
	fileIdsOf,
	fileKindLabel,
	useSimulatedTransfers,
	type TransferState,
} from "@/components/component-gallery/examples/file-upload/file-upload-shared";

const MAX_FILES = 10;
/** Largest file accepted: 50 MB each. */
const MAX_FILE_BYTES = 50 * BYTES_PER_MEGABYTE;

interface FileTableRowProps {
	readonly fileItem: FileWithPreview;
	readonly transfer: TransferState;
	readonly onRemove: (fileId: string) => void;
	readonly onRetry: (fileId: string) => void;
}

function FileTableRow({ fileItem, transfer, onRemove, onRetry }: FileTableRowProps): React.JSX.Element {
	const { file, preview } = fileItem;
	return (
		<TableRow>
			<TableCell className="py-2 ps-1.5">
				<div className="flex items-center gap-1">
					<div className="relative flex size-8 shrink-0 items-center justify-center text-muted-foreground/80">
						{transfer.status === "uploading" ? (
							<ProgressRing progress={transfer.progress} label={`${file.name} progress`} className="size-8">
								<FileKindIcon file={file} />
							</ProgressRing>
						) : (
							<FileKindIcon file={file} />
						)}
					</div>
					<p className="flex items-center gap-1 truncate text-sm font-medium">
						{file.name}
						{transfer.status === "error" ? (
							<Badge variant="destructive-light" size="sm">
								Error
							</Badge>
						) : null}
					</p>
				</div>
			</TableCell>
			<TableCell className="py-2">
				<Badge variant="secondary" className="text-xs">
					{fileKindLabel(file)}
				</Badge>
			</TableCell>
			<TableCell className="py-2 text-sm text-muted-foreground">{formatBytes(file.size)}</TableCell>
			<TableCell className="py-2">
				<div className="flex items-center gap-1">
					{/* A picked file can be saved back from its in-browser object URL; nothing is fetched. */}
					{file instanceof File && preview !== undefined ? (
						<a href={preview} download={file.name} className={buttonVariants({ variant: "ghost", size: "icon", className: "size-8" })} aria-label={`Download ${file.name}`}>
							<DownloadIcon className="size-3.5" />
						</a>
					) : null}
					{transfer.status === "error" ? (
						<FileActionButton fileId={fileItem.id} onAction={onRetry} label={`Retry ${file.name}`} className="size-8 text-destructive/80 hover:text-destructive">
							<RefreshCwIcon className="size-3.5" />
						</FileActionButton>
					) : (
						<FileActionButton fileId={fileItem.id} onAction={onRemove} label={`Remove ${file.name}`} className="size-8">
							<Trash2Icon className="size-3.5" />
						</FileActionButton>
					)}
				</div>
			</TableCell>
		</TableRow>
	);
}

export function FileUpload6Example(): React.JSX.Element {
	const { start, retry, forget, transferOf } = useSimulatedTransfers(SAMPLE_TRANSFERS);

	const handleFilesAdded = React.useCallback(
		(added: readonly FileWithPreview[]): void => {
			start(fileIdsOf(added));
		},
		[start],
	);

	const uploadOptions = React.useMemo(
		(): FileUploadOptions => ({ maxFiles: MAX_FILES, maxSize: MAX_FILE_BYTES, multiple: true, initialFiles: SAMPLE_DOCUMENT_FILES, onFilesAdded: handleFilesAdded }),
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
								<CloudUploadIcon className="size-4" />
								Add files
							</Button>
							<Button type="button" onClick={clearFiles} variant="outline" size="sm">
								<Trash2Icon className="size-4" />
								Remove all
							</Button>
						</div>
					</div>

					<div className="rounded-lg border">
						<Table>
							<TableHeader>
								<TableRow className="text-xs">
									<TableHead className="h-9 ps-4">Name</TableHead>
									<TableHead className="h-9">Type</TableHead>
									<TableHead className="h-9">Size</TableHead>
									<TableHead className="h-9 w-[100px] ps-4">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{files.map((fileItem: FileWithPreview): React.JSX.Element => (
									<FileTableRow key={fileItem.id} fileItem={fileItem} transfer={transferOf(fileItem.id)} onRemove={handleRemove} onRetry={retry} />
								))}
							</TableBody>
						</Table>
					</div>
				</div>
			) : null}

			<FileUploadErrors errors={errors} />
		</div>
	);
}
