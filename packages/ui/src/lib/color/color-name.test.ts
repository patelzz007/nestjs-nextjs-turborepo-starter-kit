import { describe, expect, it } from "vitest";

import { describeColor } from "./color-name";
import { parseColor } from "./color-parse";
import type { ColorPickerColor } from "./color-space";

const FALLBACK: ColorPickerColor = { space: "rgb", channels: [0, 0, 0], alpha: 1 };

function nameOf(input: string): ReturnType<typeof describeColor> {
	return describeColor(parseColor(input) ?? FALLBACK);
}

describe("describeColor", () => {
	it("names neutrals by lightness", (): void => {
		expect(nameOf("#000")).toStrictEqual({ kind: "neutral", name: "black" });
		expect(nameOf("#808080")).toStrictEqual({ kind: "neutral", name: "gray" });
		expect(nameOf("#fff")).toStrictEqual({ kind: "neutral", name: "white" });
	});

	it("names chromatic colours by hue, shade and tone", (): void => {
		expect(nameOf("#ff0000")).toStrictEqual({ kind: "chromatic", hue: "red", shade: "normal", tone: "vibrant" });
		expect(nameOf("#1e3a8a")).toMatchObject({ kind: "chromatic", hue: "blue", shade: "dark" });
		expect(nameOf("#8b4513")).toMatchObject({ kind: "chromatic", hue: "brown" });
		expect(nameOf("#808000")).toMatchObject({ kind: "chromatic", hue: "olive" });
	});
});
