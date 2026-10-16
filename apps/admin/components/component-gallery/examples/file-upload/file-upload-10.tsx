"use client";

import { Button, buttonVariants } from "@workspace/ui/components/button";
import { formatBytes, useFileUpload, type FileMetadata, type FileUploadOptions, type FileWithPreview } from "@workspace/ui/hooks/use-file-upload";
import { cn } from "@workspace/ui/lib/core/utils";
import { CloudUploadIcon, ImageIcon, UploadIcon, XIcon } from "lucide-react";
import * as React from "react";

import {
	BYTES_PER_MEGABYTE,
	FileDropZone,
	FilePreviewImage,
	FileUploadErrors,
	ProgressRing,
	SAMPLE_PHOTO_IDS,
	fileIdsOf,
	samplePhotoUrl,
	useSimulatedTransfers,
	type TransferState,
} from "@/components/component-gallery/examples/file-upload/file-upload-shared";

/** Largest cover accepted: 5 MB. */
const MAX_COVER_BYTES = 5 * BYTES_PER_MEGABYTE;
/** Intrinsic size of the 21:9 cover, in pixels. */
const COVER_WIDTH_PX = 1200;
const COVER_HEIGHT_PX = 514;
/** Byte size shown for the stored sample cover. */
const SAMPLE_COVER_SIZE_BYTES = 2_048_000;

const [, , SAMPLE_COVER_PHOTO_ID = ""] = SAMPLE_PHOTO_IDS;
const SAMPLE_COVER: FileMetadata = {
	id: "cover-sample",
	name: "cover-image.jpg",
	size: SAMPLE_COVER_SIZE_BYTES,
	type: "image/jpeg",
	url: samplePhotoUrl(SAMPLE_COVER_PHOTO_ID),
};
const INITIAL_FILES: readonly FileMetadata[] = [SAMPLE_COVER];

const COVER_GUIDELINES: readonly { readonly id: string; readonly text: string }[] = [
	{ id: "quality", text: "Use high-quality images with good lighting and composition" },
	{ id: "ratio", text: "Recommended aspect ratio: 21:9 (ultrawide) for best results" },
	{ id: "edges", text: "Avoid images with important content near the edges" },
	{ id: "formats", text: "Supported formats: JPG, PNG, WebP" },
];

interface CoverPreviewProps {
	readonly cover: FileWithPreview;
	readonly preview: string;
	readonly transfer: TransferState;
	readonly onChange: () => void;
	readonly onRemove: () => void;
}

/** The current cover, with a placeholder until it has loaded and a ring while it "uploads". Keyed by file id, so a new cover starts unloaded. */
function CoverPreview({ cover, preview, transfer, onChange, onRemove }: CoverPreviewProps): React.JSX.Element {
	const [isLoaded, setIsLoaded] = React.useState(false);
	const handleLoad = React.useCallback((): void => {
		setIsLoaded(true);
	}, []);

	return (
		<div className="relative aspect-21/9 w-full">
			{isLoaded ? null : (
				<div className="absolute inset-0 flex animate-pulse items-center justify-center bg-muted">
					<div className="flex flex-col items-center gap-2 text-muted-foreground">
						<ImageIcon className="size-5" aria-hidden />
						<span className="text-sm">Loading image…</span>
					</div>
				</div>
			)}

			<FilePreviewImage
				src={preview}
				alt={`Cover: ${cover.file.name}`}
				width={COVER_WIDTH_PX}
				height={COVER_HEIGHT_PX}
				onLoad={handleLoad}
				className={cn("size-full object-cover transition-opacity duration-300", isLoaded ? "opacity-100" : "opacity-0")}
			/>

			<div className="absolute inset-0 bg-background/0 transition-all duration-200 group-hover:bg-background/40" />

			<div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100">
				<div className="flex gap-2">
					<Button type="button" onClick={onChange} size="sm" variant="outline">
						<UploadIcon />
						Change cover
					</Button>
					<Button type="button" onClick={onRemove} size="sm">
						<XIcon />
						Remove
					</Button>
				</div>
			</div>

			{transfer.status === "uploading" ? (
				<div className="absolute inset-0 flex items-center justify-center bg-background/60">
					<ProgressRing progress={transfer.progress} label="Cover progress" className="size-16" indicatorClassName="text-foreground">
						<span className="text-sm font-medium text-foreground">{Math.round(transfer.progress)}%</span>
					</ProgressRing>
				</div>
			) : null}
		</div>
	);
}

export function FileUpload10Example(): React.JSX.Element {
	const { start, forget, transferOf } = useSimulatedTransfers();

	const handleFilesAdded = React.useCallback(
		(added: readonly FileWithPreview[]): void => {
			start(fileIdsOf(added));
		},
		[start],
	);

	const uploadOptions = React.useMemo(
		(): FileUploadOptions => ({ maxFiles: 1, maxSize: MAX_COVER_BYTES, accept: "image/*", multiple: false, initialFiles: INITIAL_FILES, onFilesAdded: handleFilesAdded }),
		[handleFilesAdded],
	);
	const [{ files, isDragging, errors }, actions] = useFileUpload(uploadOptions);
	const { removeFile, openFileDialog, getInputProps } = actions;
	const [cover] = files;
	const preview = cover?.preview;

	const handleRemove = React.useCallback((): void => {
		if (cover !== undefined) {
			removeFile(cover.id);
			forget(cover.id);
		}
	}, [cover, forget, removeFile]);

	return (
		<div className="w-full space-y-4">
			<input {...getInputProps()} className="sr-only" aria-label="Cover image file" tabIndex={-1} />

			{cover !== undefined && preview !== undefined ? (
				<FileDropZone
					actions={actions}
					className={cn(
						"group relative overflow-hidden rounded-xl border transition-all duration-200",
						isDragging ? "border-dashed border-primary bg-primary/5" : "border-border bg-background hover:border-primary/50",
					)}>
					<CoverPreview key={cover.id} cover={cover} preview={preview} transfer={transferOf(cover.id)} onChange={openFileDialog} onRemove={handleRemove} />
				</FileDropZone>
			) : (
				<button
					type="button"
					onClick={openFileDialog}
					onDragEnter={actions.handleDragEnter}
					onDragLeave={actions.handleDragLeave}
					onDragOver={actions.handleDragOver}
					onDrop={actions.handleDrop}
					className={cn(
						"flex aspect-21/9 w-full cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-xl border border-dashed p-8 text-center transition-all duration-200",
						isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 bg-muted/30 hover:border-primary hover:bg-primary/5",
					)}>
					<span className="rounded-full bg-primary/10 p-4">
						<CloudUploadIcon className="size-8 text-primary" aria-hidden />
					</span>

					<span className="space-y-2">
						<span className="block text-lg font-semibold">Upload cover image</span>
						<span className="block text-sm text-muted-foreground">Drag and drop an image here, or click to browse</span>
						<span className="block text-xs text-muted-foreground">
							Recommended size: {COVER_WIDTH_PX}×{COVER_HEIGHT_PX}px • Max size: {formatBytes(MAX_COVER_BYTES)}
						</span>
					</span>

					<span className={buttonVariants({ variant: "outline", size: "sm" })}>
						<ImageIcon />
						Browse files
					</span>
				</button>
			)}

			<FileUploadErrors errors={errors} />

			<div className="rounded-lg bg-muted/50 p-4">
				<h4 className="mb-2 text-sm font-medium">Cover image guidelines</h4>
				<ul className="space-y-1 text-xs text-muted-foreground">
					{COVER_GUIDELINES.map((guideline: { readonly id: string; readonly text: string }): React.JSX.Element => (
						<li key={guideline.id}>• {guideline.text}</li>
					))}
				</ul>
			</div>
		</div>
	);
}
