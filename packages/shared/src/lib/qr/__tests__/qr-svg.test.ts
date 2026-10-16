import { describe, expect, it } from "vitest";

import { encodeQr } from "../qr-encode";
import { DEFAULT_QR_QUIET_ZONE_MODULES, DEFAULT_QR_SVG_DARK_COLOR, DEFAULT_QR_SVG_LIGHT_COLOR, qrMatrixToSvgPath, QrSvgColorSchema, renderQrSvg } from "../qr-svg";

/** Every `M x y hN v1 h-N z` rectangle of a path (for stripping them all). */
const RUN_PATTERN = /M(?<x>\d+) (?<y>\d+)h(?<length>\d+)v1h-\k<length>z/gu;

/** The dark modules a path draws, as `row,column` keys, in module units without the quiet zone. */
function modulesOf(path: string, quietZone: number): Set<string> {
	const modules = new Set<string>();
	// A fresh literal per call, read with exec (rules/27: named groups are not read through matchAll).
	const runPattern = /M(?<x>\d+) (?<y>\d+)h(?<length>\d+)v1h-\k<length>z/gu;
	for (let run = runPattern.exec(path); run !== null; run = runPattern.exec(path)) {
		const x = Number(run.groups?.x);
		const y = Number(run.groups?.y);
		const length = Number(run.groups?.length);
		for (let offset = 0; offset < length; offset += 1) modules.add(`${String(y - quietZone)},${String(x - quietZone + offset)}`);
	}
	return modules;
}

describe("qrMatrixToSvgPath", () => {
	it("defaults to the 4-module quiet zone of ISO/IEC 18004", () => {
		const matrix = encodeQr("quiet zone");
		expect(DEFAULT_QR_QUIET_ZONE_MODULES).toBe(4);
		expect(qrMatrixToSvgPath(matrix).viewBoxSize).toBe(matrix.size + 8);
	});

	it("draws exactly the dark modules, one rectangle per horizontal run", () => {
		const matrix = encodeQr("https://example.com/r/ABC123");
		for (const quietZone of [0, 4]) {
			const { path } = qrMatrixToSvgPath(matrix, { quietZoneModules: quietZone });
			const expected = new Set<string>();
			for (let row = 0; row < matrix.size; row += 1)
				for (let column = 0; column < matrix.size; column += 1) if (matrix.isDark(row, column)) expected.add(`${String(row)},${String(column)}`);
			expect(modulesOf(path, quietZone)).toEqual(expected);
			// Nothing but rectangles: the path is the runs and only the runs.
			expect(path.replace(RUN_PATTERN, "")).toBe("");
		}
	});

	it("merges a horizontal run into one rectangle (the top-left finder row is 7 modules)", () => {
		const { path } = qrMatrixToSvgPath(encodeQr("run"), { quietZoneModules: 0 });
		expect(path.startsWith("M0 0h7v1h-7z")).toBe(true);
	});

	it("closes a run that touches the right edge", () => {
		const matrix = encodeQr("edge");
		const { path } = qrMatrixToSvgPath(matrix, { quietZoneModules: 0 });
		expect(path).toContain(`M${String(matrix.size - 7)} 0h7v1h-7z`);
	});

	it("rejects a negative or fractional quiet zone", () => {
		expect(() => qrMatrixToSvgPath(encodeQr("x"), { quietZoneModules: -1 })).toThrow();
		expect(() => qrMatrixToSvgPath(encodeQr("x"), { quietZoneModules: 1.5 })).toThrow();
	});
});

describe("QrSvgColorSchema", () => {
	it("accepts 3- and 6-digit hex colours only", () => {
		expect(QrSvgColorSchema.safeParse("#000").success).toBe(true);
		expect(QrSvgColorSchema.safeParse("#A1b2C3").success).toBe(true);
		expect(QrSvgColorSchema.safeParse("red").success).toBe(false);
		expect(QrSvgColorSchema.safeParse('#000" onload="x').success).toBe(false);
	});
});

describe("renderQrSvg", () => {
	it("renders a standalone SVG: background rect, one crisp path, a square viewBox with the quiet zone", () => {
		const matrix = encodeQr("otpauth://totp/A:b?secret=JBSWY3DP");
		const { path, viewBoxSize } = qrMatrixToSvgPath(matrix);
		const svg = renderQrSvg("otpauth://totp/A:b?secret=JBSWY3DP");
		const size = String(viewBoxSize);
		expect(svg).toBe(
			`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="${DEFAULT_QR_SVG_LIGHT_COLOR}"/><path fill="${DEFAULT_QR_SVG_DARK_COLOR}" d="${path}"/></svg>`,
		);
	});

	it("passes the encode options and quiet zone through, and uses custom colours", () => {
		const svg = renderQrSvg("abc", { encode: { minVersion: 3, errorCorrectionLevel: "H" }, quietZoneModules: 2, darkColor: "#112233", lightColor: "#fff" });
		// Version 3 is 29 modules; with 2 on each side the viewBox is 33.
		expect(svg).toContain('viewBox="0 0 33 33"');
		expect(svg).toContain('fill="#112233"');
		expect(svg).toContain('fill="#fff"');
	});

	it("rejects a colour that is not a hex value, so no markup can be injected", () => {
		expect(() => renderQrSvg("abc", { darkColor: '"/><script>' })).toThrow();
	});
});
