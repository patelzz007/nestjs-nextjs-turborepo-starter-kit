"use client";

import type { ImageRules } from "@workspace/shared";
import * as React from "react";

import type { ImageCropSource } from "./image-crop-dialog";
import { takeImage } from "./image-intake";

export interface UseImagePickOptions {
	/** The shape and size the image must meet (a file category's `imageRules`). */
	readonly rules: ImageRules;
	/** The photo is ready to upload: it had the shape already, or was cropped. */
	readonly onPrepared: (file: File) => void;
	/** The photo cannot be used, in words for the person (too small, unreadable). */
	readonly onRefused: (message: string) => void;
}

export interface ImagePick {
	/** Takes one picked photo: refused, prepared at once, or opened in the cropper. */
	readonly pick: (file: File) => void;
	/** The photo waiting in the cropper (`ImageCropDialog`'s `source`), or `null`. */
	readonly cropSource: ImageCropSource | null;
	/** The photo is being read (before it is prepared or opened in the cropper). */
	readonly isReading: boolean;
	/** `ImageCropDialog`'s `onCropped`. */
	readonly handleCropped: (file: File) => void;
	/** `ImageCropDialog`'s `onSkip`. */
	readonly handleSkip: () => void;
}

/** Frees what a crop session holds: the decoded photo and its preview URL. */
function release(source: ImageCropSource | null): void {
	if (source !== null) {
		source.image.close();
		URL.revokeObjectURL(source.previewUrl);
	}
}

/**
 * One image at a time (an avatar, a logo): reads the picked photo, hands a
 * ready one to `onPrepared`, and otherwise holds it for `ImageCropDialog` until
 * it is cropped or skipped. Every decoded photo and preview URL is released.
 */
export function useImagePick({ rules, onPrepared, onRefused }: UseImagePickOptions): ImagePick {
	const [cropSource, setCropSource] = React.useState<ImageCropSource | null>(null);
	const [isReading, setIsReading] = React.useState(false);
	const held = React.useRef<ImageCropSource | null>(null);

	const hold = React.useCallback((next: ImageCropSource | null): void => {
		release(held.current);
		held.current = next;
		setCropSource(next);
	}, []);

	// A photo still in the cropper when the screen goes away is released too.
	React.useEffect(
		() => (): void => {
			release(held.current);
			held.current = null;
		},
		[],
	);

	const pick = React.useCallback(
		(file: File): void => {
			setIsReading(true);
			void takeImage(file, rules)
				.then((intake): void => {
					if (intake.kind === "refused") {
						onRefused(intake.message);
					} else if (intake.kind === "prepared") {
						onPrepared(intake.file);
					} else {
						hold({ id: crypto.randomUUID(), file: intake.source, image: intake.image, previewUrl: URL.createObjectURL(intake.source) });
					}
				})
				.finally((): void => {
					setIsReading(false);
				});
		},
		[hold, onPrepared, onRefused, rules],
	);

	const handleCropped = React.useCallback(
		(file: File): void => {
			hold(null);
			onPrepared(file);
		},
		[hold, onPrepared],
	);

	const handleSkip = React.useCallback((): void => {
		hold(null);
	}, [hold]);

	return { pick, cropSource, isReading, handleCropped, handleSkip };
}
