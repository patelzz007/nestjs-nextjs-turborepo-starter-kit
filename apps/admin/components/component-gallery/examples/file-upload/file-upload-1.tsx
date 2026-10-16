"use client";

import { Button } from "@workspace/ui/components/button";
import { useFileUpload, type FileUploadOptions } from "@workspace/ui/hooks/use-file-upload";
import { CircleUserRoundIcon } from "lucide-react";
import * as React from "react";

import { FilePreviewImage } from "@/components/component-gallery/examples/file-upload/file-upload-shared";

const UPLOAD_OPTIONS: FileUploadOptions = { accept: "image/*" };
/** Intrinsic size of the avatar thumbnail, in pixels. */
const THUMBNAIL_SIZE_PX = 32;

export function FileUpload1Example(): React.JSX.Element {
	const [{ files }, { removeFile, openFileDialog, getInputProps }] = useFileUpload(UPLOAD_OPTIONS);
	const [currentFile] = files;

	const handleRemove = React.useCallback((): void => {
		if (currentFile !== undefined) {
			removeFile(currentFile.id);
		}
	}, [currentFile, removeFile]);

	const previewUrl = currentFile?.preview;
	const fileName = currentFile?.file.name;

	return (
		<div className="flex flex-col items-center gap-2">
			<div className="inline-flex items-center gap-2 align-top">
				<div className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-input">
					{previewUrl === undefined ? (
						<CircleUserRoundIcon className="size-4 opacity-60" aria-hidden />
					) : (
						<FilePreviewImage className="size-full object-cover" src={previewUrl} alt="Preview of the picked image" width={THUMBNAIL_SIZE_PX} height={THUMBNAIL_SIZE_PX} />
					)}
				</div>
				<div className="relative inline-block">
					<Button type="button" onClick={openFileDialog} aria-haspopup="dialog">
						{fileName === undefined ? "Upload image" : "Change image"}
					</Button>
					<input {...getInputProps()} className="sr-only" aria-label="Upload image file" tabIndex={-1} />
				</div>
			</div>
			<div className="inline-flex gap-2 text-xs">
				<p className="truncate text-muted-foreground" aria-live="polite">
					{fileName ?? "No image attached"}
				</p>
				{fileName === undefined ? null : (
					<button type="button" onClick={handleRemove} className="cursor-pointer font-medium text-destructive hover:underline" aria-label={`Remove ${fileName}`}>
						Remove
					</button>
				)}
			</div>
		</div>
	);
}
