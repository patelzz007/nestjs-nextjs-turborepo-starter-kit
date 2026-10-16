"use client";

import { Button } from "@workspace/ui/components/button";
import { formatBytes, useFileUpload, type FileUploadOptions } from "@workspace/ui/hooks/use-file-upload";
import { cn } from "@workspace/ui/lib/core/utils";
import { UserIcon, XIcon } from "lucide-react";
import * as React from "react";

import { BYTES_PER_MEGABYTE, FilePreviewImage, FileUploadErrors } from "@/components/component-gallery/examples/file-upload/file-upload-shared";

/** Largest avatar accepted: 2 MB. */
const MAX_AVATAR_MEGABYTES = 2;
const MAX_AVATAR_BYTES = MAX_AVATAR_MEGABYTES * BYTES_PER_MEGABYTE;
/** Intrinsic size of the round avatar preview, in pixels. */
const AVATAR_SIZE_PX = 96;

const UPLOAD_OPTIONS: FileUploadOptions = { maxFiles: 1, maxSize: MAX_AVATAR_BYTES, accept: "image/*", multiple: false };

export function FileUpload2Example(): React.JSX.Element {
	const [{ files, isDragging, errors }, { removeFile, handleDragEnter, handleDragLeave, handleDragOver, handleDrop, openFileDialog, getInputProps }] =
		useFileUpload(UPLOAD_OPTIONS);
	const [currentFile] = files;
	const previewUrl = currentFile?.preview;

	const handleRemove = React.useCallback((): void => {
		if (currentFile !== undefined) {
			removeFile(currentFile.id);
		}
	}, [currentFile, removeFile]);

	return (
		<div className="flex flex-col items-center gap-4">
			<div className="relative">
				<button
					type="button"
					aria-label={currentFile === undefined ? "Upload avatar" : "Change avatar"}
					className={cn(
						"group/avatar relative size-24 cursor-pointer overflow-hidden rounded-full border border-dashed transition-colors",
						isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/20",
						previewUrl === undefined ? null : "border-solid",
					)}
					onDragEnter={handleDragEnter}
					onDragLeave={handleDragLeave}
					onDragOver={handleDragOver}
					onDrop={handleDrop}
					onClick={openFileDialog}>
					{previewUrl === undefined ? (
						<span className="flex size-full items-center justify-center">
							<UserIcon className="size-6 text-muted-foreground" aria-hidden />
						</span>
					) : (
						<FilePreviewImage src={previewUrl} alt="Avatar" width={AVATAR_SIZE_PX} height={AVATAR_SIZE_PX} className="size-full object-cover" />
					)}
				</button>
				<input {...getInputProps()} className="sr-only" aria-label="Avatar image file" tabIndex={-1} />

				{currentFile === undefined ? null : (
					<Button type="button" size="icon" variant="outline" onClick={handleRemove} className="absolute end-0.5 top-0.5 z-10 size-6 rounded-full" aria-label="Remove avatar">
						<XIcon className="size-3.5" />
					</Button>
				)}
			</div>

			<div className="space-y-0.5 text-center">
				<p className="text-sm font-medium">{currentFile === undefined ? "Upload avatar" : "Avatar selected"}</p>
				<p className="text-xs text-muted-foreground">PNG, JPG up to {formatBytes(MAX_AVATAR_BYTES)}</p>
			</div>

			<FileUploadErrors errors={errors} />
		</div>
	);
}
