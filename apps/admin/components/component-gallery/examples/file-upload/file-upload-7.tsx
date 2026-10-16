"use client";

import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Progress } from "@workspace/ui/components/progress";
import { formatBytes, useFileUpload, type FileMetadata, type FileUploadOptions, type FileWithPreview } from "@workspace/ui/hooks/use-file-upload";
import { cn } from "@workspace/ui/lib/core/utils";
import { CircleXIcon, CloudUploadIcon, ImageIcon, XIcon } from "lucide-react";
import * as React from "react";

import {
	BYTES_PER_MEGABYTE,
	FileActionButton,
	FileDropZone,
	FilePreviewImage,
	FileUploadErrors,
	fileIdsOf,
	sampleImageFiles,
	useSimulatedTransfers,
	type TransferState,
} from "@/components/component-gallery/examples/file-upload/file-upload-shared";

const MAX_FILES = 10;
/** Largest image accepted: 2 MB each. */
const MAX_FILE_BYTES = 2 * BYTES_PER_MEGABYTE;
/** Stored product images the grid starts with. */
const SAMPLE_IMAGE_COUNT = 4;
/** Intrinsic size of a product tile, in pixels. */
const TILE_WIDTH_PX = 240;
const TILE_HEIGHT_PX = 120;

const INITIAL_FILES: readonly FileMetadata[] = sampleImageFiles(SAMPLE_IMAGE_COUNT, "product-sample");

function isPickedFile(fileItem: FileWithPreview): boolean {
	return fileItem.file instanceof File;
}

interface ProductTileProps {
	readonly fileItem: FileWithPreview;
	readonly onRemove: (fileId: string) => void;
}

function ProductTile({ fileItem, onRemove }: ProductTileProps): React.JSX.Element {
	const { file, preview } = fileItem;
	return (
		<Card className="group/item relative flex shrink-0 items-center justify-center rounded-md bg-accent/50 p-0 shadow-none">
			{preview === undefined ? (
				<ImageIcon className="size-6 text-muted-foreground" aria-hidden />
			) : (
				<FilePreviewImage src={preview} alt={file.name} width={TILE_WIDTH_PX} height={TILE_HEIGHT_PX} className="h-[120px] w-full rounded-md object-cover" />
			)}
			<FileActionButton
				fileId={fileItem.id}
				onAction={onRemove}
				label={`Remove ${file.name}`}
				variant="outline"
				className="absolute end-1 top-1 size-6 rounded-full opacity-0 shadow-sm group-hover/item:opacity-100 focus-visible:opacity-100">
				<XIcon className="size-3.5" />
			</FileActionButton>
		</Card>
	);
}

interface TransferCardProps {
	readonly fileItem: FileWithPreview;
	readonly transfer: TransferState;
	readonly onRemove: (fileId: string) => void;
}

function TransferCard({ fileItem, transfer, onRemove }: TransferCardProps): React.JSX.Element {
	const { file } = fileItem;
	return (
		<Card className="rounded-md p-0 shadow-none">
			<CardContent className="flex items-center gap-2 p-3">
				<div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border">
					<ImageIcon className="size-4 text-muted-foreground" aria-hidden />
				</div>
				<div className="flex w-full flex-col gap-1.5">
					<div className="-mt-2 flex w-full items-center justify-between gap-2.5">
						<div className="flex items-center gap-2.5">
							<span className="text-xs leading-none font-medium text-foreground">{file.name}</span>
							<span className="text-xs leading-none font-normal text-muted-foreground">{formatBytes(file.size)}</span>
							{transfer.status === "uploading" ? <p className="text-xs text-muted-foreground">Uploading… {Math.round(transfer.progress)}%</p> : null}
						</div>
						<FileActionButton fileId={fileItem.id} onAction={onRemove} label={`Remove ${file.name}`} className="size-6">
							<CircleXIcon className="size-3.5" />
						</FileActionButton>
					</div>
					<Progress value={transfer.progress} aria-label={`${file.name} progress`} />
				</div>
			</CardContent>
		</Card>
	);
}

export function FileUpload7Example(): React.JSX.Element {
	const { start, forget, transferOf } = useSimulatedTransfers();

	const handleFilesAdded = React.useCallback(
		(added: readonly FileWithPreview[]): void => {
			start(fileIdsOf(added));
		},
		[start],
	);

	const uploadOptions = React.useMemo(
		(): FileUploadOptions => ({
			maxFiles: MAX_FILES,
			maxSize: MAX_FILE_BYTES,
			accept: "image/*",
			multiple: true,
			initialFiles: INITIAL_FILES,
			onFilesAdded: handleFilesAdded,
		}),
		[handleFilesAdded],
	);
	const [{ files, isDragging, errors }, actions] = useFileUpload(uploadOptions);
	const { removeFile, openFileDialog, getInputProps } = actions;
	const pickedFiles = files.filter(isPickedFile);

	const handleRemove = React.useCallback(
		(fileId: string): void => {
			removeFile(fileId);
			forget(fileId);
		},
		[forget, removeFile],
	);

	return (
		<div className="w-full max-w-4xl">
			<div className="mb-6 grid grid-cols-4 gap-2.5">
				{files.map((fileItem: FileWithPreview): React.JSX.Element => (
					<ProductTile key={fileItem.id} fileItem={fileItem} onRemove={handleRemove} />
				))}
			</div>

			<FileDropZone actions={actions}>
				<input {...getInputProps()} className="sr-only" aria-label="Product images" tabIndex={-1} />
				<Card
					className={cn(
						"rounded-md border-dashed shadow-none transition-colors",
						isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50",
					)}>
					<CardContent className="text-center">
						<div className="mx-auto mb-3 flex size-8 items-center justify-center rounded-full border border-border">
							<CloudUploadIcon className="size-4" aria-hidden />
						</div>
						<h3 className="mb-0.5 text-sm font-semibold text-foreground">Choose a file or drag & drop here.</h3>
						<span className="mb-3 block text-xs font-normal text-secondary-foreground">JPEG, PNG, up to {formatBytes(MAX_FILE_BYTES)}.</span>
						<Button type="button" size="sm" onClick={openFileDialog}>
							Browse file
						</Button>
					</CardContent>
				</Card>
			</FileDropZone>

			{pickedFiles.length > 0 ? (
				<div className="mt-6 space-y-3">
					{pickedFiles.map((fileItem: FileWithPreview): React.JSX.Element => (
						<TransferCard key={fileItem.id} fileItem={fileItem} transfer={transferOf(fileItem.id)} onRemove={handleRemove} />
					))}
				</div>
			) : null}

			<FileUploadErrors errors={errors} />
		</div>
	);
}
