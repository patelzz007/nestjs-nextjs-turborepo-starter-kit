"use client";

import { REWARD_COVER_FILE_RULES, useUploadRewardCover, type UploadedRewardCover } from "@/lib/rewards/use-upload-reward-cover";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { CoverImage } from "@workspace/ui/components/cover-image";
import { Spinner } from "@workspace/ui/components/spinner";
import { cn } from "@workspace/ui/lib/core/utils";
import { ImagePlus } from "lucide-react";
import * as React from "react";

/** What the merchant is told about the image, once — the limits come from the shared upload policy. */
const COVER_GUIDANCE = `A landscape photo of the offer, shown on every reward card. 1200 × 675 works best. JPEG, PNG, WebP or AVIF, up to ${String(REWARD_COVER_FILE_RULES.maxMebibytes)} MB.`;

export interface MerchantRewardCoverFieldProps {
	/** The organization the cover is uploaded to — `undefined` while it loads (uploading waits for it). */
	readonly organizationId: string | undefined;
	/** The saved cover's URL (editing), or `null` before one is chosen. */
	readonly initialPreviewUrl: string | null;
	/** A cover finished uploading and passed the scan: save its id in the form. */
	readonly onCoverUploaded: (cover: UploadedRewardCover) => void;
	/** The form's validation message for the cover (e.g. "Add a cover image"). */
	readonly errorMessage?: string | undefined;
	readonly disabled?: boolean;
}

type CoverPreview = { readonly kind: "saved"; readonly url: string | null } | { readonly kind: "uploading"; readonly localUrl: string };

/**
 * The reward's cover: pick (or drop) an image, see it at once while it uploads
 * and is checked, then the published copy. Uploading never changes the reward
 * by itself — the form saves the new `coverFileId`.
 */
export function MerchantRewardCoverField({
	organizationId,
	initialPreviewUrl,
	onCoverUploaded,
	errorMessage,
	disabled = false,
}: MerchantRewardCoverFieldProps): React.JSX.Element {
	const inputId = React.useId();
	const messageId = React.useId();
	const inputRef = React.useRef<HTMLInputElement>(null);
	const [preview, setPreview] = React.useState<CoverPreview>({ kind: "saved", url: initialPreviewUrl });
	const [uploadError, setUploadError] = React.useState<string | null>(null);
	const [isDragging, setIsDragging] = React.useState(false);
	const upload = useUploadRewardCover();
	const isUploading = preview.kind === "uploading";
	const canUpload = !disabled && !isUploading && organizationId !== undefined;
	const shownUrl = preview.kind === "uploading" ? preview.localUrl : preview.url;
	const message = uploadError ?? errorMessage ?? null;

	// The instant local preview lives only while its upload runs.
	React.useEffect((): (() => void) | undefined => {
		if (preview.kind !== "uploading") {
			return undefined;
		}
		const { localUrl } = preview;
		return (): void => {
			URL.revokeObjectURL(localUrl);
		};
	}, [preview]);

	const startUpload = React.useCallback(
		(file: File): void => {
			// The controls are disabled whenever an upload is not allowed; this guards every way a file can arrive.
			if (!canUpload) {
				return;
			}
			const previousUrl = preview.url;
			setUploadError(null);
			setPreview({ kind: "uploading", localUrl: URL.createObjectURL(file) });
			upload.mutate(
				{ organizationId, file },
				{
					onSuccess: (cover: UploadedRewardCover): void => {
						setPreview({ kind: "saved", url: cover.publicUrl });
						onCoverUploaded(cover);
					},
					onError: (error: Error): void => {
						setPreview({ kind: "saved", url: previousUrl });
						setUploadError(error.message);
					},
				},
			);
		},
		[canUpload, onCoverUploaded, organizationId, preview, upload],
	);

	const handleInputChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			const [file = null] = [...(event.target.files ?? [])];
			// Clear the input so choosing the same file again still triggers a change.
			event.target.value = "";
			if (file !== null) {
				startUpload(file);
			}
		},
		[startUpload],
	);

	const openPicker = React.useCallback((): void => {
		inputRef.current?.click();
	}, []);

	const handleDragOver = React.useCallback(
		(event: React.DragEvent<HTMLElement>): void => {
			if (canUpload) {
				event.preventDefault();
				setIsDragging(true);
			}
		},
		[canUpload],
	);

	const handleDragLeave = React.useCallback((): void => {
		setIsDragging(false);
	}, []);

	const handleDrop = React.useCallback(
		(event: React.DragEvent<HTMLElement>): void => {
			event.preventDefault();
			setIsDragging(false);
			const [file = null] = [...event.dataTransfer.files];
			if (canUpload && file !== null) {
				startUpload(file);
			}
		},
		[canUpload, startUpload],
	);

	return (
		<Card className="border-border/80 bg-card shadow-xs">
			<CardHeader>
				<CardTitle>
					<label htmlFor={inputId}>Cover image</label>
				</CardTitle>
				<CardDescription>{COVER_GUIDANCE}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				<input
					ref={inputRef}
					id={inputId}
					type="file"
					accept={REWARD_COVER_FILE_RULES.accept}
					className="sr-only"
					disabled={!canUpload}
					aria-invalid={message !== null ? true : undefined}
					aria-describedby={message !== null ? messageId : undefined}
					onChange={handleInputChange}
				/>

				{shownUrl === null ? (
					<button
						type="button"
						data-slot="reward-cover-dropzone"
						data-dragging={isDragging ? true : undefined}
						disabled={!canUpload}
						onClick={openPicker}
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						onDrop={handleDrop}
						className={cn(
							"flex aspect-video w-full max-w-xl flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none",
							message !== null ? "border-destructive/60" : "border-border",
							isDragging ? "border-primary bg-primary/5" : "bg-muted/40 hover:border-primary/50 hover:bg-muted/60",
						)}>
						<ImagePlus className="size-8 text-muted-foreground" aria-hidden="true" />
						<span className="text-sm font-medium text-foreground">Upload a cover image</span>
						<span className="text-xs text-muted-foreground">Click to choose a photo, or drop one here</span>
					</button>
				) : (
					<div className="flex max-w-xl flex-col gap-3">
						<div className="relative">
							<CoverImage src={shownUrl} alt="Reward cover preview" className="rounded-xl border border-border" />
							{isUploading ? (
								<div className="absolute inset-0 flex items-center justify-center gap-2 rounded-xl bg-background/70 text-sm font-medium text-foreground backdrop-blur-[2px]">
									<Spinner className="size-4" aria-hidden="true" />
									Uploading and checking the image…
								</div>
							) : null}
						</div>
						<div className="flex items-center gap-3">
							<Button type="button" variant="outline" size="sm" disabled={!canUpload} onClick={openPicker}>
								<ImagePlus className="size-4" aria-hidden="true" />
								Replace image
							</Button>
						</div>
					</div>
				)}

				<p role="status" aria-live="polite" className="sr-only">
					{isUploading ? "Uploading the cover image" : null}
				</p>
				{message !== null ? (
					<p id={messageId} role="alert" className="text-sm text-destructive">
						{message}
					</p>
				) : null}
			</CardContent>
		</Card>
	);
}
