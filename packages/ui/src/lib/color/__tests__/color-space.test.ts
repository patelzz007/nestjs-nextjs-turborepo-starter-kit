import { describe, expect, it } from "vitest";

import {
	channelIndex,
	channelRange,
	formatFixed,
	hslToHsv,
	hsvToHsl,
	hsvToRgb,
	isColorInSrgb,
	mapTriple,
	readChannel,
	resolveChannelSpace,
	rgbToHsv,
	snapToStep,
	toSpace,
	tripleAt,
	withChannel,
	withTripleAt,
	wrapHue,
	type ColorPickerColor,
} from "../color-space";

const GRAY_WITH_HUE: ColorPickerColor = { space: "hsv", channels: [210, 0, 50], alpha: 1 };

describe("colour space helpers", () => {
	it("wraps hues and formats numbers without trailing zeros or -0", (): void => {
		expect(wrapHue(-30)).toBe(330);
		expect(wrapHue(720)).toBe(0);
		expect(formatFixed(1.5, 2)).toBe("1.5");
		expect(formatFixed(-0.0001, 2)).toBe("0");
	});

	it("maps and edits triples by position", (): void => {
		expect(mapTriple([1, 2, 3], (value: number): number => value * 2)).toStrictEqual([2, 4, 6]);
		expect(tripleAt([1, 2, 3], 2)).toBe(3);
		expect(withTripleAt([1, 2, 3], 1, 9)).toStrictEqual([1, 9, 3]);
	});

	it("converts between rgb, hsv and hsl", (): void => {
		expect(rgbToHsv([255, 0, 0])).toStrictEqual([0, 100, 100]);
		expect(hsvToRgb([120, 100, 100])).toStrictEqual([0, 255, 0]);
		expect(hsvToHsl([0, 100, 100])).toStrictEqual([0, 100, 50]);
		expect(hslToHsv([0, 100, 50])).toStrictEqual([0, 100, 100]);
	});

	it("keeps the hue of a grey across spaces", (): void => {
		expect(toSpace(GRAY_WITH_HUE, "hsl")).toStrictEqual([210, 0, 50]);
		const [, chroma, hue] = toSpace(GRAY_WITH_HUE, "oklch");
		expect(chroma).toBeLessThan(0.001);
		expect(hue).toBe(210);
	});

	it("tells whether an OKLCH colour fits sRGB", (): void => {
		expect(isColorInSrgb({ space: "oklch", channels: [50, 0.05, 200], alpha: 1 })).toBe(true);
		expect(isColorInSrgb({ space: "oklch", channels: [70, 0.35, 150], alpha: 1 })).toBe(false);
		expect(isColorInSrgb({ space: "rgb", channels: [1, 2, 3], alpha: 1 })).toBe(true);
	});

	it("reads and writes channels in the right space", (): void => {
		expect(channelIndex("oklch", "hue")).toBe(2);
		expect(channelIndex("rgb", "hue")).toBeNull();
		expect(resolveChannelSpace("hue", "oklch")).toBe("oklch");
		expect(resolveChannelSpace("red", "hsl")).toBe("rgb");
		expect(resolveChannelSpace("alpha", "oklch")).toBe("rgb");
		expect(channelRange("rgb", "red")).toStrictEqual({ max: 255, step: 1 });
		expect(channelRange("oklch", "chroma")).toStrictEqual({ max: 0.4, step: 0.004 });
		expect(readChannel(GRAY_WITH_HUE, "hsv", "brightness")).toBe(50);
		expect(withChannel(GRAY_WITH_HUE, "hsv", "saturation", 80).channels).toStrictEqual([210, 80, 50]);
		expect(withChannel(GRAY_WITH_HUE, "hsv", "alpha", 2).alpha).toBe(1);
	});

	it("snaps to a step", (): void => {
		expect(snapToStep(0.123, 0.01)).toBe(0.12);
		expect(snapToStep(7, 5)).toBe(5);
	});
});
