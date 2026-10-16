import { describe, expect, it } from "vitest";

import { channelText, readChannelText } from "../color-fields";
import { formatColor } from "../color-format";
import type { ColorPickerColor } from "../color-space";

const ORANGE: ColorPickerColor = { space: "rgb", channels: [255, 128, 0], alpha: 0.5 };

describe("channelText", () => {
	it("writes each kind of field", (): void => {
		expect(channelText(ORANGE, "rgb", "hex")).toBe("FF8000");
		expect(channelText(ORANGE, "rgb", "alpha")).toBe("50%");
		expect(channelText(ORANGE, "rgb", "green")).toBe("128");
		expect(channelText({ space: "oklch", channels: [62.345, 0.1234, 40], alpha: 1 }, "oklch", "lightness")).toBe("62.3");
		expect(channelText({ space: "oklch", channels: [62.345, 0.1234, 40], alpha: 1 }, "oklch", "chroma")).toBe("0.123");
	});
});

describe("readChannelText", () => {
	it("keeps the current opacity for a six-digit hex and takes a hex's own alpha", (): void => {
		expect(readChannelText("#00ff00", ORANGE, "rgb", "hex")?.alpha).toBe(0.5);
		expect(readChannelText("00ff00ff", ORANGE, "rgb", "hex")?.alpha).toBe(1);
		expect(readChannelText("xyz", ORANGE, "rgb", "hex")).toBeNull();
	});

	it("reads comma decimals, percentages of the range, and clamps", (): void => {
		const half = readChannelText("50%", ORANGE, "rgb", "red");
		expect(half?.channels).toStrictEqual([127.5, 128, 0]);
		expect(readChannelText("300", ORANGE, "rgb", "blue")?.channels).toStrictEqual([255, 128, 255]);
		expect(readChannelText("12,5", ORANGE, "rgb", "alpha")?.alpha).toBe(0.125);
	});

	it("reads hue angles and wraps them", (): void => {
		const hsl: ColorPickerColor = { space: "hsl", channels: [0, 100, 50], alpha: 1 };
		expect(readChannelText("-30", hsl, "hsl", "hue")?.channels).toStrictEqual([330, 100, 50]);
		expect(readChannelText("0.25turn", hsl, "hsl", "hue")?.channels).toStrictEqual([90, 100, 50]);
		expect(readChannelText("50%", hsl, "hsl", "hue")).toBeNull();
	});

	it("rejects anything else", (): void => {
		expect(readChannelText("abc", ORANGE, "rgb", "red")).toBeNull();
		expect(readChannelText("10deg", ORANGE, "rgb", "red")).toBeNull();
		const unchanged = readChannelText("255", ORANGE, "rgb", "red");
		expect(unchanged === null ? null : formatColor(unchanged, "hex")).toBe("#ff800080");
	});
});
