import { describe, expect, it } from "vitest";

import { centredCropArea, clampCropArea, cropExtendsBeyondPhoto, maxCropWidth, moveCropArea, resizeCropArea, wholePhotoCropWidth, widestCropWidth } from "./crop-area";

const WIDE = 16 / 9;
const PHOTO = { width: 6000, height: 4000 };

describe("crop area", () => {
	it("finds the widest crop of the aspect ratio, centred", () => {
		expect(maxCropWidth(PHOTO, WIDE)).toBe(6000);
		expect(centredCropArea(PHOTO, WIDE)).toEqual({ x: 0, y: 313, width: 6000, height: 3375 });
		expect(centredCropArea({ width: 9000, height: 2160 }, WIDE)).toEqual({ x: 2580, y: 0, width: 3840, height: 2160 });
	});

	it("keeps a crop inside the photo by moving it", () => {
		expect(clampCropArea({ x: -50, y: 900, width: 3840, height: 2160 }, PHOTO)).toEqual({ x: 0, y: 900, width: 3840, height: 2160 });
		expect(clampCropArea({ x: 5000, y: 3000, width: 3840, height: 2160 }, PHOTO)).toEqual({ x: 2160, y: 1840, width: 3840, height: 2160 });
	});

	it("zooms around the crop's centre, never below the minimum width nor beyond the photo", () => {
		const full = centredCropArea(PHOTO, WIDE);
		expect(resizeCropArea(full, 4000, PHOTO, WIDE, 3840)).toEqual({ x: 1000, y: 876, width: 4000, height: 2250 });
		expect(resizeCropArea(full, 1000, PHOTO, WIDE, 3840).width).toBe(3840);
		expect(resizeCropArea(full, 99_999, PHOTO, WIDE, 3840)).toEqual(full);
	});

	it("moves a crop, stopping at the photo's edges", () => {
		const area = { x: 1000, y: 1000, width: 3840, height: 2160 };
		expect(moveCropArea(area, 200, -300, PHOTO)).toEqual({ x: 1200, y: 700, width: 3840, height: 2160 });
		expect(moveCropArea(area, -5000, 5000, PHOTO)).toEqual({ x: 0, y: 1840, width: 3840, height: 2160 });
	});

	it("finds the crop that shows the whole photo, wider than the photo for a taller shape", () => {
		expect(wholePhotoCropWidth(PHOTO, WIDE)).toBe(7112);
		expect(wholePhotoCropWidth({ width: 9000, height: 2160 }, WIDE)).toBe(9000);
		expect(widestCropWidth(PHOTO, WIDE, "fill")).toBe(6000);
		expect(widestCropWidth(PHOTO, WIDE, "whole-photo")).toBe(7112);
	});

	it("zooms out to the whole photo when allowed, centring the photo along the side the crop overhangs", () => {
		const full = centredCropArea(PHOTO, WIDE);
		const whole = resizeCropArea(full, 99_999, PHOTO, WIDE, 3840, "whole-photo");
		expect(whole).toEqual({ x: -556, y: -1, width: 7112, height: 4001 });
		expect(cropExtendsBeyondPhoto(whole, PHOTO)).toBe(true);
		expect(cropExtendsBeyondPhoto(full, PHOTO)).toBe(false);
	});

	it("keeps an overhanging crop centred: it cannot be dragged off the photo", () => {
		const whole = { x: -556, y: -1, width: 7112, height: 4001 };
		expect(moveCropArea(whole, 900, 0, PHOTO)).toEqual(whole);
	});
});
