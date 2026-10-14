// ============================================
// lib/media/crop-area.ts — a fixed-shape crop of a photo, in its own pixels
// ============================================
// Pure geometry for `ImageCropper`: the crop always keeps one aspect ratio and
// is never narrower than a minimum width (so a crop cannot be zoomed past the
// resolution its use needs). How far it zooms out is the use's choice
// (`CropZoomOutLimit`): until it fills the frame with the photo, or until the
// whole photo shows — then the crop is larger than the photo along one side,
// and the photo is centred along that side.

/** A region of a photo, in the photo's (upright) pixels. */
export interface CropArea {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

/** The photo's size in pixels. */
export interface CropBounds {
	readonly width: number;
	readonly height: number;
}

/**
 * How far a crop zooms out: `fill` — the photo always fills the frame (the
 * widest crop inside the photo); `whole-photo` — out to the crop that shows the
 * entire photo, leaving room around it along one side.
 */
export type CropZoomOutLimit = "fill" | "whole-photo";

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/** The widest crop of `aspect` (width ÷ height) that fits the photo. */
export function maxCropWidth(bounds: CropBounds, aspect: number): number {
	return Math.min(bounds.width, Math.floor(bounds.height * aspect));
}

/** The narrowest crop of `aspect` that shows the entire photo. */
export function wholePhotoCropWidth(bounds: CropBounds, aspect: number): number {
	return Math.max(bounds.width, Math.ceil(bounds.height * aspect));
}

/** The widest crop a zoom-out limit allows. */
export function widestCropWidth(bounds: CropBounds, aspect: number, limit: CropZoomOutLimit): number {
	return limit === "fill" ? maxCropWidth(bounds, aspect) : wholePhotoCropWidth(bounds, aspect);
}

/** Whether the crop reaches past the photo's edges (it shows room around the photo). */
export function cropExtendsBeyondPhoto(area: CropArea, bounds: CropBounds): boolean {
	return area.x < 0 || area.y < 0 || area.x + area.width > bounds.width || area.y + area.height > bounds.height;
}

/** One side of a crop placed along the photo: inside it when it fits, else centred over it. */
function placeAlong(start: number, length: number, photoLength: number): number {
	// An overhang is at least one pixel, so the centred start is at most -0.5: flooring keeps it a whole, negative pixel.
	return length > photoLength ? Math.floor((photoLength - length) / 2) : Math.round(clamp(start, 0, photoLength - length));
}

/**
 * Keeps a crop over the photo, moving it (never resizing it): inside the photo
 * along each side it fits, and centred along a side it is longer than.
 */
export function clampCropArea(area: CropArea, bounds: CropBounds): CropArea {
	return {
		...area,
		x: placeAlong(area.x, area.width, bounds.width),
		y: placeAlong(area.y, area.height, bounds.height),
	};
}

/** A crop of `width` around the same centre as `area` — `width` limited to [`minWidth`, the widest crop `limit` allows]. */
export function resizeCropArea(area: CropArea, width: number, bounds: CropBounds, aspect: number, minWidth: number, limit: CropZoomOutLimit = "fill"): CropArea {
	const widest = widestCropWidth(bounds, aspect, limit);
	const nextWidth = Math.round(clamp(width, Math.min(minWidth, widest), widest));
	const nextHeight = Math.round(nextWidth / aspect);
	const centreX = area.x + area.width / 2;
	const centreY = area.y + area.height / 2;
	return clampCropArea({ x: centreX - nextWidth / 2, y: centreY - nextHeight / 2, width: nextWidth, height: nextHeight }, bounds);
}

/** The widest crop of `aspect`, centred in the photo. */
export function centredCropArea(bounds: CropBounds, aspect: number): CropArea {
	const width = maxCropWidth(bounds, aspect);
	const height = Math.round(width / aspect);
	return { x: Math.round((bounds.width - width) / 2), y: Math.round((bounds.height - height) / 2), width, height };
}

/** The crop moved by (`dx`, `dy`) photo pixels, kept inside the photo. */
export function moveCropArea(area: CropArea, dx: number, dy: number, bounds: CropBounds): CropArea {
	return clampCropArea({ ...area, x: area.x + dx, y: area.y + dy }, bounds);
}
