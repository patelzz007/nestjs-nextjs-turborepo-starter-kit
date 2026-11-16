import { contrastRatio, formatColor, hslToRgb, hsvToRgb, isInSrgb, oklchToRgb, parseColor, parseHex, rgbToHsl, rgbToHsv, rgbToOklch, toHex } from "../color";

const BLUE = { r: 59, g: 130, b: 246, a: 1 };

describe("hex", () => {
	it("reads short, long and see-through hex, and writes it back", () => {
		expect(parseHex("#3b82f6")).toStrictEqual(BLUE);
		expect(parseHex("fff")).toStrictEqual({ r: 255, g: 255, b: 255, a: 1 });
		expect(parseHex("#00000080")?.a).toBeCloseTo(0.5, 2);
		expect(parseHex("#12")).toBeNull();
		expect(toHex(BLUE)).toBe("#3b82f6");
		expect(toHex({ ...BLUE, a: 0.5 })).toBe("#3b82f680");
	});
});

describe("HSV and HSL", () => {
	it("go to RGB and back", () => {
		expect(toHex(hsvToRgb(rgbToHsv(BLUE)))).toBe("#3b82f6");
		expect(toHex(hsvToRgb({ h: 0, s: 1, v: 1, a: 1 }))).toBe("#ff0000");
		expect(rgbToHsv({ r: 128, g: 128, b: 128, a: 1 }).s).toBe(0);
		const hsl = rgbToHsl(BLUE);
		expect(toHex(hslToRgb(hsl.h, hsl.s, hsl.l, 1))).toBe("#3b82f6");
		expect(rgbToHsl({ r: 255, g: 255, b: 255, a: 1 })).toStrictEqual({ h: 0, s: 0, l: 1 });
	});
});

describe("OKLCH", () => {
	it("goes to RGB and back, and knows sRGB's edge", () => {
		const oklch = rgbToOklch(BLUE);
		expect(oklch.l).toBeCloseTo(0.623, 2);
		expect(toHex(oklchToRgb(oklch))).toBe("#3b82f6");
		expect(isInSrgb(oklch)).toBe(true);
		expect(isInSrgb({ l: 0.7, c: 0.4, h: 150, a: 1 })).toBe(false);
	});
});

describe("parseColor and formatColor", () => {
	it("read every text form", () => {
		expect(parseColor("rgb(59, 130, 246)")).toStrictEqual(BLUE);
		expect(parseColor("rgba(59 130 246 / 50%)")?.a).toBe(0.5);
		expect(toHex(parseColor("hsl(217, 91%, 60%)") ?? BLUE)).toBe("#3c83f6");
		expect(toHex(parseColor("oklch(62.3% 0.188 259.8)") ?? BLUE)).toMatch(/^#3[ab]8[12]f[56]$/u);
		expect(parseColor("blue-ish")).toBeNull();
	});

	it("write every text form, with alpha only when the colour is see-through", () => {
		expect(formatColor(BLUE, "hex")).toBe("#3b82f6");
		expect(formatColor(BLUE, "rgb")).toBe("rgb(59, 130, 246)");
		expect(formatColor({ ...BLUE, a: 0.5 }, "rgb")).toBe("rgba(59, 130, 246, 0.5)");
		expect(formatColor(BLUE, "hsl")).toBe("hsl(217, 91%, 60%)");
		expect(formatColor({ ...BLUE, a: 0.25 }, "hsl")).toBe("hsla(217, 91%, 60%, 0.25)");
		expect(formatColor(BLUE, "oklch")).toMatch(/^oklch\(0\.62\d 0\.1\d\d 2\d\d\)$/u);
		expect(formatColor({ ...BLUE, a: 0.5 }, "oklch")).toMatch(/ \/ 0\.5\)$/u);
	});
});

describe("contrastRatio", () => {
	it("is 21 for black on white and 1 for a colour on itself", () => {
		expect(contrastRatio({ r: 0, g: 0, b: 0, a: 1 }, { r: 255, g: 255, b: 255, a: 1 })).toBeCloseTo(21, 1);
		expect(contrastRatio(BLUE, BLUE)).toBe(1);
	});
});
