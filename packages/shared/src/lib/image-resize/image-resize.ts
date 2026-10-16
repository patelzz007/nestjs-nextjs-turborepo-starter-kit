import { z } from "zod";

/**
 * Pure geometry for the drag-to-resize image (`ImageResizer` in the web kit, the native kit and
 * the docs site). No DOM, React Native or Intl API: every renderer turns its own pointer, touch,
 * keyboard or screen-reader input into a handle and a distance, and gets the next size from here,
 * so all of them clamp, snap and keep the aspect ratio identically.
 *
 * Sizes are in layout pixels (CSS pixels on the web, points on mobile) and always whole numbers.
 * The image is laid out from its top-left corner, so a handle never moves the image: dragging any
 * handle away from the image grows it, towards the image shrinks it.
 */

/** Every handle, clockwise from the top-left corner. */
export const IMAGE_RESIZE_HANDLES: readonly ["top-left", "top", "top-right", "right", "bottom-right", "bottom", "bottom-left", "left"] = [
	"top-left",
	"top",
	"top-right",
	"right",
	"bottom-right",
	"bottom",
	"bottom-left",
	"left",
];

export const ImageResizeHandleSchema = z.enum(IMAGE_RESIZE_HANDLES);

/** One grab point on the image's frame: a corner or the middle of an edge. */
export type ImageResizeHandle = z.infer<typeof ImageResizeHandleSchema>;

/** The four corners: enough for most uses, and the only handles that resize both sides freely at once. */
export const IMAGE_RESIZE_CORNER_HANDLES: readonly ImageResizeHandle[] = ["top-left", "top-right", "bottom-right", "bottom-left"];

/** The smallest side by default, in pixels: an image still large enough to see and to grab. */
export const DEFAULT_IMAGE_RESIZE_MIN_SIZE_PX = 48;
/** How far one arrow-key press (or one screen-reader step) moves a handle, in pixels. */
export const IMAGE_RESIZE_STEP_PX = 10;
/** How far one Shift + arrow-key press moves a handle, in pixels. */
export const IMAGE_RESIZE_LARGE_STEP_PX = 50;

/** An image's rendered size, in layout pixels. */
export interface ImageSize {
	readonly width: number;
	readonly height: number;
}

/** A pointer's travel since a drag started, in layout pixels (right and down are positive). */
export interface ImageResizeDelta {
	readonly x: number;
	readonly y: number;
}

/** The bounds a resize stays within. */
export interface ImageResizeConstraints {
	readonly minWidth: number;
	readonly minHeight: number;
	/** `Infinity` for no upper bound. */
	readonly maxWidth: number;
	readonly maxHeight: number;
	/** Width ÷ height to keep while resizing; `null` lets width and height change independently. */
	readonly aspectRatio: number | null;
}

/** What a caller may leave out of `ImageResizeConstraints` (or pass as `undefined`); the rest takes the defaults. */
export type ImageResizeConstraintsInput = { readonly [Key in keyof ImageResizeConstraints]?: ImageResizeConstraints[Key] | undefined };

/** The caller's bounds cannot hold any size (a minimum above its maximum, a side or ratio that is not positive). */
export class InvalidImageResizeConstraintsError extends Error {
	public constructor(message: string) {
		super(`Invalid image resize constraints: ${message}`);
		this.name = "InvalidImageResizeConstraintsError";
	}
}

/** Which way a handle moves its side when dragged right/down: the start edge (`-1`), not at all (`0`), or the end edge (`1`). */
export type ImageResizeDirection = -1 | 0 | 1;

/** How a handle's travel maps onto width (`x`) and height (`y`). */
export interface ImageResizeHandleAxis {
	readonly x: ImageResizeDirection;
	readonly y: ImageResizeDirection;
}

const START_EDGE: ImageResizeDirection = -1;
const FIXED: ImageResizeDirection = 0;
const END_EDGE: ImageResizeDirection = 1;

const HANDLE_AXES: Readonly<Record<ImageResizeHandle, ImageResizeHandleAxis>> = {
	"top-left": { x: START_EDGE, y: START_EDGE },
	top: { x: FIXED, y: START_EDGE },
	"top-right": { x: END_EDGE, y: START_EDGE },
	right: { x: END_EDGE, y: FIXED },
	"bottom-right": { x: END_EDGE, y: END_EDGE },
	bottom: { x: FIXED, y: END_EDGE },
	"bottom-left": { x: START_EDGE, y: END_EDGE },
	left: { x: START_EDGE, y: FIXED },
};

/** How `handle` changes the size: dragging the `right` handle right grows the width, the `left` handle right shrinks it. */
export function imageResizeHandleAxis(handle: ImageResizeHandle): ImageResizeHandleAxis {
	return HANDLE_AXES[handle];
}

/** Whether `handle` is a corner (it moves both a vertical and a horizontal side). */
export function isImageResizeCornerHandle(handle: ImageResizeHandle): boolean {
	const axis = HANDLE_AXES[handle];
	return axis.x !== FIXED && axis.y !== FIXED;
}

/**
 * The caller's bounds with the defaults filled in: no side under `DEFAULT_IMAGE_RESIZE_MIN_SIZE_PX`,
 * no upper bound, free aspect ratio. Throws `InvalidImageResizeConstraintsError` for bounds no size fits.
 */
export function resolveImageResizeConstraints(input: ImageResizeConstraintsInput = {}): ImageResizeConstraints {
	const constraints: ImageResizeConstraints = {
		minWidth: input.minWidth ?? DEFAULT_IMAGE_RESIZE_MIN_SIZE_PX,
		minHeight: input.minHeight ?? DEFAULT_IMAGE_RESIZE_MIN_SIZE_PX,
		maxWidth: input.maxWidth ?? Number.POSITIVE_INFINITY,
		maxHeight: input.maxHeight ?? Number.POSITIVE_INFINITY,
		aspectRatio: input.aspectRatio ?? null,
	};
	if (!(constraints.minWidth > 0) || !(constraints.minHeight > 0)) {
		throw new InvalidImageResizeConstraintsError("the minimum width and height must be positive");
	}
	if (constraints.minWidth > constraints.maxWidth || constraints.minHeight > constraints.maxHeight) {
		throw new InvalidImageResizeConstraintsError("a minimum is larger than its maximum");
	}
	if (constraints.aspectRatio !== null && !(constraints.aspectRatio > 0 && Number.isFinite(constraints.aspectRatio))) {
		throw new InvalidImageResizeConstraintsError("the aspect ratio must be a positive, finite number");
	}
	return constraints;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/**
 * The closest size within `constraints`, in whole pixels. With an aspect ratio, the width is
 * clamped to what both the width and height bounds allow at that ratio, and the height follows it;
 * when the bounds leave no width that satisfies both, the minimum wins (an image never shrinks
 * below what can still be grabbed).
 */
export function clampImageSize(size: ImageSize, constraints: ImageResizeConstraints): ImageSize {
	const { aspectRatio } = constraints;
	if (aspectRatio === null) {
		return {
			width: Math.round(clamp(size.width, constraints.minWidth, constraints.maxWidth)),
			height: Math.round(clamp(size.height, constraints.minHeight, constraints.maxHeight)),
		};
	}
	const narrowest = Math.max(constraints.minWidth, constraints.minHeight * aspectRatio);
	const widest = Math.max(narrowest, Math.min(constraints.maxWidth, constraints.maxHeight * aspectRatio));
	const width = Math.round(clamp(size.width, narrowest, widest));
	return { width, height: Math.round(width / aspectRatio) };
}

/**
 * The size after dragging `handle` by `delta` from a drag that began at `start`. Always computed
 * from the drag's start (never accumulated move by move), so rounding never drifts. With an aspect
 * ratio, an edge handle drives its own side and a corner follows whichever side the pointer
 * stretched further.
 */
export function resizeImageByHandle(start: ImageSize, handle: ImageResizeHandle, delta: ImageResizeDelta, constraints: ImageResizeConstraints): ImageSize {
	const axis = HANDLE_AXES[handle];
	const width = start.width + axis.x * delta.x;
	const height = start.height + axis.y * delta.y;
	const { aspectRatio } = constraints;
	if (aspectRatio === null) {
		return clampImageSize({ width, height }, constraints);
	}
	const widthFromHeight = height * aspectRatio;
	const lockedWidth = axis.y === FIXED || (axis.x !== FIXED && Math.abs(width - start.width) >= Math.abs(widthFromHeight - start.width)) ? width : widthFromHeight;
	return clampImageSize({ width: lockedWidth, height: lockedWidth / aspectRatio }, constraints);
}

/**
 * The size after moving `handle` `distance` pixels straight away from the image (a negative
 * distance moves it towards the image) — one screen-reader increment or decrement.
 */
export function nudgeImageSize(size: ImageSize, handle: ImageResizeHandle, distance: number, constraints: ImageResizeConstraints): ImageSize {
	const axis = HANDLE_AXES[handle];
	return resizeImageByHandle(size, handle, { x: axis.x * distance, y: axis.y * distance }, constraints);
}

/** Whether two sizes are the same, so a renderer reports only real changes. */
export function isSameImageSize(first: ImageSize, second: ImageSize): boolean {
	return first.width === second.width && first.height === second.height;
}
