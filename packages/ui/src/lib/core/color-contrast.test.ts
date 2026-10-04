import { describe, expect, it } from "vitest";

import { contrastRatio, findContrastViolations, readCustomProperties, relativeLuminance } from "./color-contrast";

describe("color contrast", () => {
	it("matches the WCAG reference values for black and white", () => {
		expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
		expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
		expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
		expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
	});

	it("reads oklch() — white and black, and a mid grey", () => {
		expect(relativeLuminance("oklch(1 0 0)")).toBeCloseTo(1, 3);
		expect(relativeLuminance("oklch(0 0 0)")).toBeCloseTo(0, 5);
		// #777777 is oklch(0.5693 0 0); its WCAG contrast on white is 4.48.
		expect(contrastRatio("oklch(0.5693 0 0)", "#ffffff")).toBeCloseTo(4.48, 1);
	});

	it("rejects a colour notation it cannot measure", () => {
		expect(() => relativeLuminance("rgb(0 0 0)")).toThrow(/Unsupported colour notation/u);
	});

	it("reads a block's custom properties and resolves var() against the fallback", () => {
		const css = ":root {\n\t--a: #ffffff;\n\t--b: var(--a);\n}\n.dark {\n\t--a: #000000;\n\t--c: var(--b);\n}";
		const light = readCustomProperties(css, ":root");
		const dark = readCustomProperties(css, ".dark", light);

		expect(light.get("--b")).toBe("#ffffff");
		expect(dark.get("--a")).toBe("#000000");
		expect(dark.get("--c")).toBe("#ffffff");
		expect(() => readCustomProperties(css, ".missing")).toThrow(/No ".missing" block/u);
	});
});

describe("findContrastViolations", () => {
	it("names each pairing below its minimum", () => {
		const theme = new Map<string, string>([
			["--background", "#ffffff"],
			["--card", "#ffffff"],
			["--popover", "#ffffff"],
			["--muted", "#ffffff"],
			["--sidebar", "#ffffff"],
			["--sidebar-accent", "#ffffff"],
			["--ring", "#eeeeee"],
			["--sidebar-ring", "#000000"],
			["--chart-1", "#000000"],
			["--chart-2", "#000000"],
			["--chart-3", "#000000"],
			["--chart-4", "#000000"],
			["--chart-5", "#000000"],
			["--search-mark-bg", "#000000"],
			["--search-mark-fg", "#ffffff"],
			["--muted-foreground", "#000000"],
		]);

		const violations = findContrastViolations(theme);

		expect(violations).toHaveLength(5);
		expect(violations.every((line) => line.startsWith("--ring on "))).toBe(true);
	});
});
