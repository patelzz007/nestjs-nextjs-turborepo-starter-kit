import { describe, expect, it } from "vitest";

import {
	clampImageSize,
	DEFAULT_IMAGE_RESIZE_MIN_SIZE_PX,
	IMAGE_RESIZE_CORNER_HANDLES,
	IMAGE_RESIZE_HANDLES,
	imageResizeHandleAxis,
	ImageResizeHandleSchema,
	InvalidImageResizeConstraintsError,
	isImageResizeCornerHandle,
	isSameImageSize,
	nudgeImageSize,
	resizeImageByHandle,
	resolveImageResizeConstraints,
	type ImageResizeConstraints,
	type ImageSize,
} from "../image-resize";

const START: ImageSize = { width: 400, height: 300 };
const FREE: ImageResizeConstraints = resolveImageResizeConstraints({ minWidth: 100, minHeight: 50, maxWidth: 800, maxHeight: 600 });
const FOUR_BY_THREE = 4 / 3;
const LOCKED: ImageResizeConstraints = resolveImageResizeConstraints({ minWidth: 100, minHeight: 50, maxWidth: 800, maxHeight: 600, aspectRatio: FOUR_BY_THREE });

describe("handles", () => {
	it("lists all eight, and the four corners among them", () => {
		expect(IMAGE_RESIZE_HANDLES).toHaveLength(8);
		expect(IMAGE_RESIZE_CORNER_HANDLES.every((handle) => IMAGE_RESIZE_HANDLES.includes(handle))).toBe(true);
		expect(IMAGE_RESIZE_HANDLES.filter(isImageResizeCornerHandle)).toEqual(["top-left", "top-right", "bottom-right", "bottom-left"]);
	});

	it("parses handle names and rejects anything else", () => {
		expect(ImageResizeHandleSchema.parse("bottom-right")).toBe("bottom-right");
		expect(ImageResizeHandleSchema.safeParse("middle").success).toBe(false);
	});

	it("maps each handle onto the sides it moves", () => {
		expect(imageResizeHandleAxis("top-left")).toEqual({ x: -1, y: -1 });
		expect(imageResizeHandleAxis("right")).toEqual({ x: 1, y: 0 });
		expect(imageResizeHandleAxis("bottom")).toEqual({ x: 0, y: 1 });
		expect(imageResizeHandleAxis("bottom-left")).toEqual({ x: -1, y: 1 });
	});
});

describe("resolveImageResizeConstraints", () => {
	it("fills the defaults: a grabbable minimum, no maximum, free aspect ratio", () => {
		expect(resolveImageResizeConstraints()).toEqual({
			minWidth: DEFAULT_IMAGE_RESIZE_MIN_SIZE_PX,
			minHeight: DEFAULT_IMAGE_RESIZE_MIN_SIZE_PX,
			maxWidth: Number.POSITIVE_INFINITY,
			maxHeight: Number.POSITIVE_INFINITY,
			aspectRatio: null,
		});
	});

	it("rejects bounds no size can fit", () => {
		expect(() => resolveImageResizeConstraints({ minWidth: 0 })).toThrow(InvalidImageResizeConstraintsError);
		expect(() => resolveImageResizeConstraints({ minHeight: 500, maxHeight: 400 })).toThrow("a minimum is larger than its maximum");
		expect(() => resolveImageResizeConstraints({ aspectRatio: 0 })).toThrow("aspect ratio");
		expect(() => resolveImageResizeConstraints({ aspectRatio: Number.POSITIVE_INFINITY })).toThrow(InvalidImageResizeConstraintsError);
	});

	it("names its error", () => {
		const error = new InvalidImageResizeConstraintsError("bad");
		expect(error.name).toBe("InvalidImageResizeConstraintsError");
		expect(error.message).toBe("Invalid image resize constraints: bad");
	});
});

describe("clampImageSize", () => {
	it("keeps each side within its bounds and rounds to whole pixels", () => {
		expect(clampImageSize({ width: 20.4, height: 900 }, FREE)).toEqual({ width: 100, height: 600 });
		expect(clampImageSize({ width: 333.6, height: 222.2 }, FREE)).toEqual({ width: 334, height: 222 });
	});

	it("keeps the aspect ratio, bounded by whichever side runs out first", () => {
		// 600 tall at 4:3 is 800 wide, so the height bound caps the width there.
		expect(clampImageSize({ width: 2000, height: 1 }, LOCKED)).toEqual({ width: 800, height: 600 });
		// 50 tall at 4:3 is 67 wide: the width minimum (100) is the stricter one.
		expect(clampImageSize({ width: 10, height: 1 }, LOCKED)).toEqual({ width: 100, height: 75 });
	});

	it("lets the minimum win when the bounds leave no width that fits both at the ratio", () => {
		const tight = resolveImageResizeConstraints({ minWidth: 300, maxWidth: 1000, minHeight: 50, maxHeight: 100, aspectRatio: 1 });
		expect(clampImageSize({ width: 500, height: 500 }, tight)).toEqual({ width: 300, height: 300 });
	});
});

describe("resizeImageByHandle", () => {
	it("grows when a handle is dragged away from the image and shrinks when dragged towards it", () => {
		expect(resizeImageByHandle(START, "bottom-right", { x: 40, y: 20 }, FREE)).toEqual({ width: 440, height: 320 });
		expect(resizeImageByHandle(START, "top-left", { x: 40, y: 20 }, FREE)).toEqual({ width: 360, height: 280 });
		expect(resizeImageByHandle(START, "left", { x: -40, y: 99 }, FREE)).toEqual({ width: 440, height: 300 });
		expect(resizeImageByHandle(START, "top", { x: 99, y: -30 }, FREE)).toEqual({ width: 400, height: 330 });
	});

	it("stops at the bounds", () => {
		expect(resizeImageByHandle(START, "bottom-right", { x: 9999, y: -9999 }, FREE)).toEqual({ width: 800, height: 50 });
	});

	it("keeps the ratio: an edge drives its own side", () => {
		expect(resizeImageByHandle(START, "right", { x: 80, y: 0 }, LOCKED)).toEqual({ width: 480, height: 360 });
		expect(resizeImageByHandle(START, "bottom", { x: 0, y: 60 }, LOCKED)).toEqual({ width: 480, height: 360 });
	});

	it("keeps the ratio: a corner follows the side stretched further", () => {
		// Width +40 vs height +60 (= width +80 at 4:3): the height wins.
		expect(resizeImageByHandle(START, "bottom-right", { x: 40, y: 60 }, LOCKED)).toEqual({ width: 480, height: 360 });
		// Width +120 vs height +30 (= width +40): the width wins.
		expect(resizeImageByHandle(START, "bottom-right", { x: 120, y: 30 }, LOCKED)).toEqual({ width: 520, height: 390 });
	});
});

describe("nudgeImageSize", () => {
	it("moves a handle straight out (or in, for a negative distance)", () => {
		expect(nudgeImageSize(START, "bottom-right", 10, FREE)).toEqual({ width: 410, height: 310 });
		expect(nudgeImageSize(START, "top-left", 10, FREE)).toEqual({ width: 410, height: 310 });
		expect(nudgeImageSize(START, "left", -10, FREE)).toEqual({ width: 390, height: 300 });
		expect(nudgeImageSize(START, "bottom", 10, LOCKED)).toEqual({ width: 413, height: 310 });
	});
});

describe("isSameImageSize", () => {
	it("compares both sides", () => {
		expect(isSameImageSize(START, { width: 400, height: 300 })).toBe(true);
		expect(isSameImageSize(START, { width: 400, height: 301 })).toBe(false);
	});
});
