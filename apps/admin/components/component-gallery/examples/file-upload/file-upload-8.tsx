"use client";

import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Progress } from "@workspace/ui/components/progress";
import { Sortable, SortableItem, SortableItemHandle } from "@workspace/ui/components/sortable";
import { toastMessage } from "@workspace/ui/components/toast";
import { formatBytes, useFileUpload, type FileMetadata, type FileUploadOptions, type FileWithPreview } from "@workspace/ui/hooks/use-file-upload";
import { cn } from "@workspace/ui/lib/core/utils";
import { CircleXIcon, CloudUploadIcon, GripVerticalIcon, ImageIcon, XIcon } from "lucide-react";
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
/** Largest image accepted: 10 MB each. */
const MAX_FILE_BYTES = 10 * BYTES_PER_MEGABYTE;
/** Stored images the grid starts with. */
const SAMPLE_IMAGE_COUNT = 5;
/** Intrinsic size of a sortable tile, in pixels. */
const TILE_WIDTH_PX = 240;
const TILE_HEIGHT_PX = 120;
/** How long the "reordered" toast stays up, in milliseconds. */
const REORDER_TOAST_TIMEOUT_MS = 3000;

const INITIAL_FILES: readonly FileMetadata[] = sampleImageFiles(SAMPLE_IMAGE_COUNT, "sortable-sample");
const INITIAL_ORDER: readonly string[] = INITIAL_FILES.map((file: FileMetadata): string => file.id);

/** Sortable items are the file ids themselves. */
function itemIdOf(fileId: string): string {
	return fileId;
}

function isPickedFile(fileItem: FileWithPreview): boolean {
	return fileItem.file instanceof File;
}

interface SortableTileProps {
	readonly fileItem: FileWithPreview;
	readonly onRemove: (fileId: string) => void;
}

function SortableTile({ fileItem, onRemove }: SortableTileProps): React.JSX.Element {
	const { file, preview } = fileItem;
	return (
		<SortableItem value={fileItem.id}>
			<div className="group/item relative flex shrink-0 items-center justify-center rounded-md border border-border bg-accent/50 shadow-none transition-all duration-200 hover:z-10 hover:bg-accent/70 data-[dragging=true]:z-50">
				{preview === undefined ? (
					<ImageIcon className="size-6 text-muted-foreground" aria-hidden />
				) : (
					<FilePreviewImage
						src={preview}
						alt={file.name}
						width={TILE_WIDTH_PX}
						height={TILE_HEIGHT_PX}
						className="pointer-events-none h-[120px] w-full rounded-md object-cover"
					/>
				)}

				<SortableItemHandle
					aria-label={`Reorder ${file.name}`}
					className="absolute start-2 top-2 flex size-6 items-center justify-center rounded-full border border-border bg-background opacity-0 group-hover/item:opacity-100">
					<GripVerticalIcon className="size-3.5" aria-hidden />
				</SortableItemHandle>

				<FileActionButton
					fileId={fileItem.id}
					onAction={onRemove}
					label={`Remove ${file.name}`}
					variant="outline"
					className="absolute end-2 top-2 size-6 rounded-full opacity-0 shadow-sm group-hover/item:opacity-100 focus-visible:opacity-100">
					<XIcon className="size-3.5" />
				</FileActionButton>
			</div>
		</SortableItem>
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
		<Card className="rounded-md shadow-none">
			<CardContent className="flex items-center gap-2 p-2.5">
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

export function FileUpload8Example(): React.JSX.Element {
	const { start, forget, transferOf } = useSimulatedTransfers();
	/** The grid's order, as file ids; picked files join at the end. */
	const [order, setOrder] = React.useState<string[]>((): string[] => [...INITIAL_ORDER]);

	const handleFilesAdded = React.useCallback(
		(added: readonly FileWithPreview[]): void => {
			const addedIds = fileIdsOf(added);
			setOrder((previous: string[]): string[] => [...previous, ...addedIds]);
			start(addedIds);
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

	const orderedFiles = order.flatMap((fileId: string): readonly FileWithPreview[] => files.filter((fileItem: FileWithPreview): boolean => fileItem.id === fileId));
	const pickedFiles = files.filter(isPickedFile);

	const handleRemove = React.useCallback(
		(fileId: string): void => {
			removeFile(fileId);
			forget(fileId);
			setOrder((previous: string[]): string[] => previous.filter((id: string): boolean => id !== fileId));
		},
		[forget, removeFile],
	);

	const handleReorder = React.useCallback((next: string[]): void => {
		setOrder(next);
		toastMessage.success({ title: "Images reordered", timeout: REORDER_TOAST_TIMEOUT_MS });
	}, []);

	return (
		<div className="w-full max-w-4xl">
			<div className="mb-4 text-center">
				<p className="text-sm text-muted-foreground">
					Upload up to {MAX_FILES} images (JPG, PNG, GIF, WebP, max {formatBytes(MAX_FILE_BYTES)} each). <br />
					Drag and drop images to reorder.
					{pickedFiles.length > 0 ? ` ${String(files.length)}/${String(MAX_FILES)} images.` : null}
				</p>
			</div>

			<div className="mb-6">
				<Sortable value={order} onValueChange={handleReorder} getItemValue={itemIdOf} strategy="grid" className="grid auto-rows-fr grid-cols-5 gap-2.5">
					{orderedFiles.map((fileItem: FileWithPreview): React.JSX.Element => (
						<SortableTile key={fileItem.id} fileItem={fileItem} onRemove={handleRemove} />
					))}
				</Sortable>
			</div>

			<FileDropZone actions={actions}>
				<input {...getInputProps()} className="sr-only" aria-label="Images" tabIndex={-1} />
				<Card
					className={cn(
						"rounded-md border-dashed shadow-none transition-colors",
						isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50",
					)}>
					<CardContent className="text-center">
						<div className="mx-auto mb-3 flex size-8 items-center justify-center rounded-full border border-border">
							<CloudUploadIcon className="size-4" aria-hidden />
						</div>
						<h3 className="mb-0.5 text-sm font-medium text-foreground">Choose a file or drag & drop here.</h3>
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
