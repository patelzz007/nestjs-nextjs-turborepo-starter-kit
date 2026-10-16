import { labelColors, relativeLuminance } from "../label-colors";

describe("label colours", () => {
	it("measures WCAG relative luminance from black to white", () => {
		expect(relativeLuminance("000000")).toBe(0);
		expect(relativeLuminance("ffffff")).toBeCloseTo(1);
		// WCAG's own reference value for pure red.
		expect(relativeLuminance("ff0000")).toBeCloseTo(0.2126);
	});

	it("puts dark text on a light label and light text on a dark one", () => {
		expect(labelColors("a2eeef")).toEqual({ background: "#a2eeef", text: "#000000" });
		expect(labelColors("d73a4a")).toEqual({ background: "#d73a4a", text: "#ffffff" });
		expect(labelColors("0E8A16")).toEqual({ background: "#0E8A16", text: "#ffffff" });
	});
});
