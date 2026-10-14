"use client";

import { LIST_SLOT_INDEX, type ImageSource } from "@workspace/shared";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/core/utils";
import { fixedImageSizes, imageSrcSet } from "@workspace/ui/lib/media/image-sources";
import * as React from "react";

/** How the image is framed: a circle (a person) or a rounded square (a logo). */
export type ImageSlotShape = "circle" | "rounded";

export interface ImageSlotFieldLabels {
	/** Accessible name of the file input, e.g. "Profile picture". */
	readonly input: string;
	/** The image's alt text, e.g. "Your profile picture". */
	readonly image: string;
	/** The pick button with no image yet, e.g. "Upload photo". */
	readonly upload: string;
	/** The pick button with an image, e.g. "Replace photo". */
	readonly replace: string;
	readonly remove: string;
	/** The pick button while something runs, e.g. "Working…". */
	readonly busy: string;
}

export interface ImageSlotFieldProps {
	/** Public URL of the live image, or `null` when there is none. */
	readonly imageUrl: string | null;
	/** Its renditions, smallest first — the preview downloads only the one sharp at its size. */
	readonly imageSources?: readonly ImageSource[] | undefined;
	/** Shown when there is no image (initials or a name monogram). */
	readonly fallback: string;
	readonly shape: ImageSlotShape;
	readonly labels: ImageSlotFieldLabels;
	/** The `accept` attribute — from the shared file policy, never hand-written. */
	readonly accept: string;
	/** Human-readable limits shown under the controls. */
	readonly hint: string;
	readonly isBusy: boolean;
	readonly isReadOnly: boolean;
	readonly onPick: (file: File) => void;
	readonly onRemove: () => void;
}

const ROUNDED_FRAME = "rounded-xl after:rounded-xl";

/**
 * One image (a profile picture, a store logo): its preview and the
 * upload / replace / remove controls. Data-agnostic and controlled: the caller
 * owns the crop, the upload, the delete and the refreshed URL.
 */
/** The preview is `size-16`: 64 CSS pixels. */
const PREVIEW_PX = 64;

export function ImageSlotField({
	imageUrl,
	imageSources,
	fallback,
	shape,
	labels,
	accept,
	hint,
	isBusy,
	isReadOnly,
	onPick,
	onRemove,
}: ImageSlotFieldProps): React.JSX.Element {
	const inputId = React.useId();
	const hintId = React.useId();
	const inputRef = React.useRef<HTMLInputElement>(null);
	const isDisabled = isBusy || isReadOnly;
	const frame = shape === "rounded" ? ROUNDED_FRAME : undefined;

	const handleChoose = React.useCallback((): void => {
		inputRef.current?.click();
	}, []);

	const handleChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			const file: File | undefined = event.target.files?.[LIST_SLOT_INDEX.first];
			// Reset so picking the same file again still fires a change.
			event.target.value = "";
			if (file !== undefined) {
				onPick(file);
			}
		},
		[onPick],
	);

	return (
		<div className="flex items-center gap-4" data-slot="image-slot-field">
			<Avatar className={cn("size-16", frame)}>
				{imageUrl === null ? null : <AvatarImage src={imageUrl} srcSet={imageSrcSet(imageSources)} sizes={fixedImageSizes(PREVIEW_PX)} alt={labels.image} className={frame} />}
				<AvatarFallback className={cn("text-lg font-semibold", frame)}>{fallback}</AvatarFallback>
			</Avatar>
			<div className="space-y-2">
				<label htmlFor={inputId} className="sr-only">
					{labels.input}
				</label>
				<input ref={inputRef} id={inputId} type="file" accept={accept} className="sr-only" aria-describedby={hintId} disabled={isDisabled} onChange={handleChange} />
				<div className="flex gap-2">
					<Button type="button" variant="outline" size="sm" disabled={isDisabled} onClick={handleChoose}>
						{isBusy ? labels.busy : imageUrl === null ? labels.upload : labels.replace}
					</Button>
					{imageUrl === null ? null : (
						<Button type="button" variant="ghost" size="sm" disabled={isDisabled} onClick={onRemove}>
							{labels.remove}
						</Button>
					)}
				</div>
				<p id={hintId} className="text-xs text-muted-foreground">
					{hint}
				</p>
			</div>
		</div>
	);
}
