"use client";

import { Button } from "@workspace/ui/components/button";
import { formatBytes, useFileUpload, type FileUploadOptions, type FileWithPreview } from "@workspace/ui/hooks/use-file-upload";
import { cn } from "@workspace/ui/lib/core/utils";
import { FileIcon, PlusIcon, XIcon } from "lucide-react";
import type * as React from "react";

import {
	BYTES_PER_MEGABYTE,
	FileActionButton,
	FileDropZone,
	FilePreviewImage,
	FileUploadErrors,
	isImageFile,
} from "@/components/component-gallery/examples/file-upload/file-upload-shared";

const MAX_FILES = 3;
/** Largest file accepted: 2 MB. */
const MAX_FILE_BYTES = 2 * BYTES_PER_MEGABYTE;
/** Intrinsic size of each thumbnail, in pixels. */
const THUMBNAIL_SIZE_PX = 48;

const UPLOAD_OPTIONS: FileUploadOptions = { maxFiles: MAX_FILES, maxSize: MAX_FILE_BYTES, accept: "image/*", multiple: true };

function fileTitle(fileItem: FileWithPreview): string {
	return `${fileItem.file.name} (${formatBytes(fileItem.file.size)})`;
}

export function FileUpload3Example(): React.JSX.Element {
	const [{ files, isDragging, errors }, actions] = useFileUpload(UPLOAD_OPTIONS);
	const { removeFile, openFileDialog, getInputProps } = actions;

	return (
		<div className="w-full max-w-lg">
			<FileDropZone
				actions={actions}
				className={cn(
					"flex items-center gap-3 rounded-lg border border-dashed border-border p-4 transition-colors",
					isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50",
				)}>
				<input {...getInputProps()} className="sr-only" aria-label="Image files" tabIndex={-1} />

				<Button type="button" onClick={openFileDialog} size="sm" className={cn(isDragging ? "animate-bounce" : null)}>
					<PlusIcon className="size-4" />
					Add files
				</Button>

				<div className="flex flex-1 items-center gap-2">
					{files.length === 0 ? (
						<p className="text-sm text-muted-foreground">Drop files here or click to browse (max {MAX_FILES} files)</p>
					) : (
						files.map((fileItem: FileWithPreview): React.JSX.Element => (
							<div key={fileItem.id} className="group/item relative shrink-0" title={fileTitle(fileItem)}>
								{isImageFile(fileItem.file) && fileItem.preview !== undefined ? (
									<FilePreviewImage
										src={fileItem.preview}
										alt={fileItem.file.name}
										width={THUMBNAIL_SIZE_PX}
										height={THUMBNAIL_SIZE_PX}
										className="size-12 rounded-lg border object-cover"
									/>
								) : (
									<div className="flex size-12 items-center justify-center rounded-lg border bg-muted">
										<FileIcon className="size-5 text-muted-foreground" aria-hidden />
									</div>
								)}

								<FileActionButton
									fileId={fileItem.id}
									onAction={removeFile}
									label={`Remove ${fileItem.file.name}`}
									variant="outline"
									className="absolute -end-2 -top-2 size-5 rounded-full opacity-0 shadow-md transition-opacity group-hover/item:opacity-100 focus-visible:opacity-100">
									<XIcon className="size-3" />
								</FileActionButton>
							</div>
						))
					)}
				</div>

				{files.length > 0 ? (
					<div className="shrink-0 text-xs text-muted-foreground">
						{files.length}/{MAX_FILES}
					</div>
				) : null}
			</FileDropZone>

			<FileUploadErrors errors={errors} />
		</div>
	);
}
