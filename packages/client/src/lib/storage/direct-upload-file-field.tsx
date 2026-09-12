"use client";

import type { FileCategory, FileRecord } from "@workspace/shared";
import { Button } from "@workspace/ui/components/form/button";
import { Label } from "@workspace/ui/components/form/label";
import * as React from "react";

import type { ApiClient } from "../api/use-api";
import type { ApiRouter } from "../api/endpoints";
import { uploadFileDirect, toDocumentMimeType, type DirectUploadInput } from "./direct-upload";

export interface DirectUploadFileFieldProps {
	readonly api: ApiClient<ApiRouter>;
	readonly category: FileCategory;
	readonly label: string;
	readonly binding: Omit<DirectUploadInput, "category" | "fileName" | "mimeType">;
	readonly value: FileRecord | null;
	readonly onChange?: (file: FileRecord | null) => void;
	readonly accept?: string;
	readonly helperText?: string;
	readonly disabled?: boolean;
}

export function DirectUploadFileField({
	api,
	category,
	label,
	binding,
	value,
	onChange,
	accept = "image/jpeg,image/png,image/webp,image/avif,application/pdf",
	helperText,
	disabled = false,
}: DirectUploadFileFieldProps): React.JSX.Element {
	const inputRef = React.useRef<HTMLInputElement>(null);
	const [error, setError] = React.useState<string | null>(null);
	const [isUploading, setIsUploading] = React.useState(false);
	const [progressLabel, setProgressLabel] = React.useState<string | null>(null);

	const handlePick = React.useCallback((): void => {
		inputRef.current?.click();
	}, []);

	const handleSelected = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			setError(null);
			const file = event.target.files?.[0];
			event.target.value = "";
			if (file === undefined) {
				return;
			}

			setIsUploading(true);
			setProgressLabel(`Uploading ${file.name}…`);

			void uploadFileDirect(
				api,
				{
					...binding,
					category,
					fileName: file.name,
					mimeType: toDocumentMimeType(file),
				},
				file,
			)
				.then((result): void => {
					onChange?.(result.response.file);
					setProgressLabel(result.response.file.status === "READY" ? `${file.name} is ready` : `${file.name} uploaded — processing`);
				})
				.catch((err: unknown): void => {
					const message = err instanceof Error && err.message.length > 0 ? err.message : "Upload failed";
					setError(message);
					setProgressLabel(null);
				})
				.finally((): void => {
					setIsUploading(false);
				});
		},
		[api, binding, category, onChange],
	);

	const handleClear = React.useCallback((): void => {
		onChange?.(null);
		setProgressLabel(null);
		setError(null);
	}, [onChange]);

	return (
		<div className="space-y-2">
			<Label>{label}</Label>
			<input ref={inputRef} type="file" accept={accept} className="hidden" disabled={disabled || isUploading} onChange={handleSelected} />
			<div className="flex flex-wrap items-center gap-2">
				<Button type="button" variant="outline" size="sm" disabled={disabled || isUploading} onClick={handlePick}>
					{isUploading ? "Uploading…" : value === null ? "Choose file" : "Replace file"}
				</Button>
				{value !== null ? (
					<Button type="button" variant="ghost" size="sm" disabled={disabled || isUploading} onClick={handleClear}>
						Remove
					</Button>
				) : null}
			</div>
			{value !== null ? (
				<p className="text-sm text-muted-foreground">
					{value.originalName} — {value.status}
				</p>
			) : null}
			{progressLabel !== null ? <p className="text-xs text-muted-foreground">{progressLabel}</p> : null}
			{helperText !== undefined ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
			{error !== null ? <p className="text-xs text-destructive">{error}</p> : null}
		</div>
	);
}
