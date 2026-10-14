"use client";

import type { ImageRules } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { ImageCropper } from "@workspace/ui/components/image-cropper";
import { Spinner } from "@workspace/ui/components/spinner";
import type { CropArea } from "@workspace/ui/lib/media/crop-area";
import * as React from "react";

import { aspectOf, exportPreparedImage, initialImageCrop } from "./image-preparation";

/** A picked photo that needs cropping, upright. */
export interface ImageCropSource {
	/** Identifies this pick (the same file can be picked twice). */
	readonly id: string;
	readonly file: File;
	readonly image: ImageBitmap;
	/** An object URL of `file` for the preview — owned (and revoked) by whoever queued the photo. */
	readonly previewUrl: string;
}

export interface ImageCropDialogProps {
	/** The photo being cropped — `null` closes the dialog. */
	readonly source: ImageCropSource | null;
	/** The shape and size the result must meet (a file category's `imageRules`). */
	readonly rules: ImageRules;
	readonly title: string;
	/** What the shape is for, and that zooming all the way out keeps the whole photo. */
	readonly description: string;
	/** The confirm button, e.g. "Use photo". */
	readonly confirmLabel: string;
	/** The skip / cancel button, e.g. "Skip this photo". */
	readonly cancelLabel: string;
	/** The crop is prepared (the rules' shape, at its own size up to the widest rendition): upload it. */
	readonly onCropped: (file: File) => void;
	/** The person skipped this photo (the cancel button, Escape or closing the dialog). */
	readonly onSkip: () => void;
}

type CropperBodyProps = Omit<ImageCropDialogProps, "source"> & { readonly source: ImageCropSource };

/** One photo's crop session; keyed by the photo so every photo starts centred, filling the frame. */
function CropperBody({ source, rules, title, description, confirmLabel, cancelLabel, onCropped, onSkip }: CropperBodyProps): React.JSX.Element {
	const bounds = React.useMemo(() => ({ width: source.image.width, height: source.image.height }), [source.image]);
	const [area, setArea] = React.useState<CropArea>(() => initialImageCrop(bounds, rules));
	const [isPreparing, setIsPreparing] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);

	const prepare = React.useCallback(async (): Promise<void> => {
		setIsPreparing(true);
		setError(null);
		try {
			onCropped(await exportPreparedImage(source.image, area, rules, source.file.name));
		} catch (error) {
			setIsPreparing(false);
			setError(error instanceof Error ? error.message : "The image could not be prepared. Try another photo.");
		}
	}, [area, onCropped, rules, source]);

	const handleUse = React.useCallback((): void => {
		void prepare();
	}, [prepare]);

	return (
		<>
			<DialogHeader>
				<DialogTitle>{title}</DialogTitle>
				<DialogDescription>{description}</DialogDescription>
			</DialogHeader>
			<ImageCropper
				src={source.previewUrl}
				bounds={bounds}
				aspect={aspectOf(rules)}
				minCropWidth={rules.minWidth}
				zoomOutLimit="whole-photo"
				value={area}
				onValueChange={setArea}
				disabled={isPreparing}
			/>
			{error !== null ? (
				<p role="alert" className="text-sm text-destructive">
					{error}
				</p>
			) : null}
			<DialogFooter>
				<Button type="button" variant="outline" disabled={isPreparing} onClick={onSkip}>
					{cancelLabel}
				</Button>
				<Button type="button" disabled={isPreparing} onClick={handleUse}>
					{isPreparing ? <Spinner className="size-4" aria-hidden="true" /> : null}
					{confirmLabel}
				</Button>
			</DialogFooter>
		</>
	);
}

/**
 * Crops one picked photo to an image category's shape, exporting it at its own
 * size up to the widest rendition. Zoomed all the way out it keeps the whole
 * photo, a blurred copy of it filling the room around it. Closing the dialog
 * skips the photo; nothing is uploaded from here.
 */
export function ImageCropDialog({ source, ...props }: ImageCropDialogProps): React.JSX.Element {
	const { onSkip } = props;
	const handleOpenChange = React.useCallback(
		(open: boolean): void => {
			if (!open) {
				onSkip();
			}
		},
		[onSkip],
	);
	return (
		<Dialog open={source !== null} onOpenChange={handleOpenChange}>
			{/* A wide frame gets a wide dialog; a square or tall one a narrow dialog, so the frame fits the screen's height. */}
			<DialogContent className={aspectOf(props.rules) > 1 ? "sm:max-w-3xl" : "sm:max-w-md"}>
				{source === null ? null : <CropperBody key={source.id} source={source} {...props} />}
			</DialogContent>
		</Dialog>
	);
}
