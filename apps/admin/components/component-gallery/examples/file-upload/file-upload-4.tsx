"use client";

import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Spinner } from "@workspace/ui/components/spinner";
import { formatBytes, useFileUpload, type FileUploadOptions, type FileWithPreview } from "@workspace/ui/hooks/use-file-upload";
import { cn } from "@workspace/ui/lib/core/utils";
import { ImageIcon, UploadIcon, XIcon, ZoomInIcon } from "lucide-react";
import * as React from "react";

import {
	BYTES_PER_MEGABYTE,
	FileActionButton,
	FileDropZone,
	FilePreviewImage,
	FileUploadErrors,
	isImageFile,
	sampleImageFiles,
} from "@/components/component-gallery/examples/file-upload/file-upload-shared";

const MAX_FILES = 10;
/** Largest image accepted: 5 MB each. */
const MAX_FILE_BYTES = 5 * BYTES_PER_MEGABYTE;
/** Stored images the gallery starts with. */
const SAMPLE_IMAGE_COUNT = 3;
/** Intrinsic size of a gallery tile, in pixels. */
const TILE_SIZE_PX = 240;
/** Intrinsic size of the enlarged preview, in pixels. */
const PREVIEW_WIDTH_PX = 1000;
const PREVIEW_HEIGHT_PX = 800;

const UPLOAD_OPTIONS: FileUploadOptions = {
	maxFiles: MAX_FILES,
	maxSize: MAX_FILE_BYTES,
	accept: "image/*",
	multiple: true,
	initialFiles: sampleImageFiles(SAMPLE_IMAGE_COUNT, "gallery-sample"),
};

function totalBytes(files: readonly FileWithPreview[]): number {
	return files.reduce((total: number, fileItem: FileWithPreview): number => total + fileItem.file.size, 0);
}

interface GalleryTileProps {
	readonly fileItem: FileWithPreview;
	readonly onView: (fileId: string) => void;
	readonly onRemove: (fileId: string) => void;
}

/** One image of the gallery, with a spinner until its thumbnail has loaded. */
function GalleryTile({ fileItem, onView, onRemove }: GalleryTileProps): React.JSX.Element {
	const [isLoaded, setIsLoaded] = React.useState(false);
	const handleLoad = React.useCallback((): void => {
		setIsLoaded(true);
	}, []);
	const { preview } = fileItem;

	return (
		<div className="group/item relative aspect-square overflow-hidden rounded-lg">
			{isImageFile(fileItem.file) && preview !== undefined ? (
				<>
					{isLoaded ? null : (
						<div className="absolute inset-0 flex items-center justify-center rounded-lg border bg-muted/50">
							<Spinner className="size-6 text-muted-foreground" />
						</div>
					)}
					<FilePreviewImage
						src={preview}
						alt={fileItem.file.name}
						width={TILE_SIZE_PX}
						height={TILE_SIZE_PX}
						onLoad={handleLoad}
						className={cn("size-full rounded-lg border object-cover transition-all group-hover/item:scale-105", isLoaded ? "opacity-100" : "opacity-0")}
					/>
				</>
			) : (
				<div className="flex size-full items-center justify-center rounded-lg border bg-muted">
					<ImageIcon className="size-8 text-muted-foreground" aria-hidden />
				</div>
			)}

			<div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/60 opacity-0 transition-opacity group-focus-within/item:opacity-100 group-hover/item:opacity-100">
				{preview === undefined ? null : (
					<FileActionButton fileId={fileItem.id} onAction={onView} label={`View ${fileItem.file.name}`} variant="secondary" className="size-7">
						<ZoomInIcon />
					</FileActionButton>
				)}
				<FileActionButton fileId={fileItem.id} onAction={onRemove} label={`Remove ${fileItem.file.name}`} variant="secondary" className="size-7">
					<XIcon />
				</FileActionButton>
			</div>

			<div className="absolute inset-x-0 bottom-0 rounded-b-lg bg-background/80 p-2 text-foreground opacity-0 transition-opacity group-hover/item:opacity-100">
				<p className="truncate text-xs font-medium">{fileItem.file.name}</p>
				<p className="text-xs text-muted-foreground">{formatBytes(fileItem.file.size)}</p>
			</div>
		</div>
	);
}

export function FileUpload4Example(): React.JSX.Element {
	const [selectedId, setSelectedId] = React.useState<string | null>(null);
	const [isPreviewLoading, setIsPreviewLoading] = React.useState(false);

	const [{ files, isDragging, errors }, actions] = useFileUpload(UPLOAD_OPTIONS);
	const { removeFile, clearFiles, openFileDialog, getInputProps } = actions;
	const selectedPreview = files.find((fileItem: FileWithPreview): boolean => fileItem.id === selectedId)?.preview;

	const handleView = React.useCallback((fileId: string): void => {
		setSelectedId(fileId);
		setIsPreviewLoading(true);
	}, []);

	const handleOpenChange = React.useCallback((open: boolean): void => {
		if (!open) {
			setSelectedId(null);
		}
	}, []);

	const handlePreviewLoad = React.useCallback((): void => {
		setIsPreviewLoading(false);
	}, []);

	return (
		<div className="w-full max-w-4xl">
			<FileDropZone
				actions={actions}
				className={cn(
					"relative rounded-lg border border-dashed p-8 text-center transition-colors",
					isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50",
				)}>
				<input {...getInputProps()} className="sr-only" aria-label="Gallery images" tabIndex={-1} />

				<div className="flex flex-col items-center gap-4">
					<div className={cn("flex size-16 items-center justify-center rounded-full", isDragging ? "bg-primary/10" : "bg-muted")}>
						<ImageIcon className={cn("size-5", isDragging ? "text-primary" : "text-muted-foreground")} aria-hidden />
					</div>

					<div className="space-y-2">
						<h3 className="text-lg font-semibold">Upload images to gallery</h3>
						<p className="text-sm text-muted-foreground">Drag and drop images here or click to browse</p>
						<p className="text-xs text-muted-foreground">
							PNG, JPG, GIF up to {formatBytes(MAX_FILE_BYTES)} each (max {MAX_FILES} files)
						</p>
					</div>

					<Button type="button" onClick={openFileDialog}>
						<UploadIcon className="size-4" />
						Select images
					</Button>
				</div>
			</FileDropZone>

			{files.length > 0 ? (
				<>
					<div className="mt-6 flex items-center justify-between">
						<div className="flex items-center gap-4">
							<h4 className="text-sm font-medium">
								Gallery ({files.length}/{MAX_FILES})
							</h4>
							<div className="text-xs text-muted-foreground">Total: {formatBytes(totalBytes(files))}</div>
						</div>
						<Button type="button" onClick={clearFiles} variant="outline" size="sm">
							Clear all
						</Button>
					</div>

					<div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
						{files.map((fileItem: FileWithPreview): React.JSX.Element => (
							<GalleryTile key={fileItem.id} fileItem={fileItem} onView={handleView} onRemove={removeFile} />
						))}
					</div>
				</>
			) : null}

			<FileUploadErrors errors={errors} />

			<Dialog open={selectedPreview !== undefined} onOpenChange={handleOpenChange}>
				<DialogContent className="w-full border-none bg-transparent p-0 shadow-none sm:max-w-xl">
					<DialogHeader className="sr-only">
						<DialogTitle>Image preview</DialogTitle>
					</DialogHeader>
					<div className="flex items-center justify-center">
						{selectedPreview === undefined ? null : (
							<>
								{isPreviewLoading ? (
									<div className="absolute inset-0 flex items-center justify-center">
										<Spinner className="size-8 text-foreground" />
									</div>
								) : null}
								<FilePreviewImage
									src={selectedPreview}
									alt="Preview"
									width={PREVIEW_WIDTH_PX}
									height={PREVIEW_HEIGHT_PX}
									onLoad={handlePreviewLoad}
									className={cn("h-full w-auto rounded-lg object-contain transition-opacity duration-300", isPreviewLoading ? "opacity-0" : "opacity-100")}
								/>
							</>
						)}
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
