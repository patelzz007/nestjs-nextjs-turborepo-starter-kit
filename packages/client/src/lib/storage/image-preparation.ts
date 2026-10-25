import { describeImageDimensionProblem, findImageDimensionProblem, type ImageRules, largestRenditionWidth } from "@workspace/shared";
import { centredCropArea, cropExtendsBeyondPhoto, resizeCropArea, wholePhotoCropWidth, type CropArea, type CropBounds } from "@workspace/ui/lib/media/crop-area";

// ============================================
// lib/storage/image-preparation.ts — make a picked photo meet an image category's rules
// ============================================
// The browser half of sharp uploads (the API re-checks the stored bytes and
// renders the published renditions): read the photo upright, choose a crop of
// the category's exact aspect ratio — which may be zoomed out past the photo to
// show all of it, the room around it filled with a blurred copy of the photo —
// and export that crop at its own size, but
// no wider than the widest rendition (4K for reward images) — downscaling a
// larger photo in the browser keeps the upload a few MB instead of a 20 MB
// camera file, while a smaller one is never upscaled.

/** The photo cannot become a valid image: its whole frame (or the chosen crop) is smaller than the rules allow. */
export class ImagePreparationError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "ImagePreparationError";
	}
}

/** WebP quality of the prepared upload — visually lossless; the API renders the published renditions from it. */
export const PREPARED_IMAGE_QUALITY = 0.92;

/**
 * Width, in pixels, the photo is shrunk to before it is stretched over the room
 * around a whole photo: scaling that far down and back up is a soft blur that
 * every browser's canvas draws (unlike `context.filter`).
 */
const BACKDROP_BLUR_WIDTH = 32;

/** The format browsers without a WebP encoder (canvas.toBlob) fall back to. */
const FALLBACK_MIME_TYPE = "image/jpeg";
const PREFERRED_MIME_TYPE = "image/webp";

/** The aspect ratio (width ÷ height) every image of the rules has. */
export function aspectOf(rules: Pick<ImageRules, "aspectWidth" | "aspectHeight">): number {
	return rules.aspectWidth / rules.aspectHeight;
}

/**
 * Whether a `width` × `height` photo can become an image of the rules' minimum
 * size — at least when zoomed out to show all of it (else it cannot be used at all).
 */
export function canReachMinimum(width: number, height: number, rules: ImageRules): boolean {
	return wholePhotoCropWidth({ width, height }, aspectOf(rules)) >= rules.minWidth;
}

/** Whether the photo already has the exact aspect ratio (no crop step needed). */
export function hasExactAspect(width: number, height: number, rules: ImageRules): boolean {
	return findImageDimensionProblem(width, height, { ...rules, minWidth: 1, minHeight: 1 }) === null;
}

/** Why a crop cannot be used (`null`: it can) — in the same words the API uses. */
export function describeCropProblem(area: CropArea, rules: ImageRules): string | null {
	const problem = findImageDimensionProblem(area.width, area.height, rules);
	return problem === null ? null : describeImageDimensionProblem(problem, rules);
}

/** A prepared image's size in pixels. */
export interface PreparedImageSize {
	readonly width: number;
	readonly height: number;
}

/**
 * The size a crop `area` is exported at: its own width, capped at the widest
 * rendition (no screen is served more), rounded down to a whole number of
 * aspect units so the result is exactly the rules' ratio (1921 wide → 1920 × 1080).
 */
export function preparedImageSize(area: Pick<CropArea, "width">, rules: ImageRules): PreparedImageSize {
	const width = Math.min(area.width, largestRenditionWidth(rules));
	const units = Math.floor(width / rules.aspectWidth);
	return { width: units * rules.aspectWidth, height: units * rules.aspectHeight };
}

/**
 * Where a photo's crop starts: the widest crop of the rules' shape that fills the
 * frame, widened to the minimum size when the photo is too small to fill it (the
 * crop then shows room around the photo, as zooming out to the whole photo does).
 */
export function initialImageCrop(bounds: CropBounds, rules: ImageRules): CropArea {
	const aspect = aspectOf(rules);
	const filled = centredCropArea(bounds, aspect);
	return resizeCropArea(filled, filled.width, bounds, aspect, rules.minWidth, "whole-photo");
}

/** Decodes a picked photo upright (its EXIF orientation applied). */
export function readUprightImage(file: Blob): Promise<ImageBitmap> {
	return createImageBitmap(file, { imageOrientation: "from-image" });
}

/** Fills the canvas with a soft, enlarged copy of the photo — the room around a whole photo. */
function drawBackdrop(context: CanvasRenderingContext2D, image: ImageBitmap, size: PreparedImageSize): void {
	const small = document.createElement("canvas");
	small.width = BACKDROP_BLUR_WIDTH;
	small.height = Math.max(1, Math.round((BACKDROP_BLUR_WIDTH * size.height) / size.width));
	const smallContext = small.getContext("2d");
	if (smallContext === null) {
		return;
	}
	const cover = centredCropArea({ width: image.width, height: image.height }, size.width / size.height);
	smallContext.imageSmoothingQuality = "high";
	smallContext.drawImage(image, cover.x, cover.y, cover.width, cover.height, 0, 0, small.width, small.height);
	context.drawImage(small, 0, 0, size.width, size.height);
}

function encode(canvas: HTMLCanvasElement, mimeType: string): Promise<Blob | null> {
	return new Promise((resolve) => {
		canvas.toBlob(resolve, mimeType, PREPARED_IMAGE_QUALITY);
	});
}

/**
 * Renders `area` of the upright photo at {@link preparedImageSize} (e.g. a 4032-wide
 * crop at 3840 × 2160, a 2400-wide one at 2400 × 1350) as WebP — JPEG where the
 * browser cannot encode WebP. A crop zoomed out past the photo shows all of it,
 * over a blurred copy of it. Throws
 * {@link ImagePreparationError} when the crop is too small or has the wrong shape.
 */
export async function exportPreparedImage(image: ImageBitmap, area: CropArea, rules: ImageRules, fileName: string): Promise<File> {
	const problem = describeCropProblem(area, rules);
	if (problem !== null) {
		throw new ImagePreparationError(problem);
	}
	const size = preparedImageSize(area, rules);
	const canvas = document.createElement("canvas");
	canvas.width = size.width;
	canvas.height = size.height;
	const context = canvas.getContext("2d");
	if (context === null) {
		throw new ImagePreparationError("This browser cannot prepare images. Try another browser.");
	}
	context.imageSmoothingEnabled = true;
	context.imageSmoothingQuality = "high";
	if (cropExtendsBeyondPhoto(area, image)) {
		drawBackdrop(context, image, size);
	}
	// The whole photo, placed so that `area` lands on the canvas (the canvas clips the rest) — a
	// source rectangle reaching past the photo is drawn differently by different browsers.
	const scale = size.width / area.width;
	context.drawImage(image, -area.x * scale, -area.y * scale, image.width * scale, image.height * scale);
	const webp = await encode(canvas, PREFERRED_MIME_TYPE);
	const blob = webp?.type === PREFERRED_MIME_TYPE ? webp : await encode(canvas, FALLBACK_MIME_TYPE);
	if (blob === null) {
		throw new ImagePreparationError("The image could not be prepared. Try another photo.");
	}
	const extension = blob.type === PREFERRED_MIME_TYPE ? "webp" : "jpg";
	const baseName = fileName.replace(/\.[^.]+$/u, "");
	return new File([blob], `${baseName}.${extension}`, { type: blob.type });
}
