import { describe, expect, it } from "vitest";

import { qrFormatBits, qrVersionBits } from "../qr-format-info";
import {
	buildFunctionPatterns,
	drawAlignmentPattern,
	drawAlignmentPatterns,
	drawFinderPattern,
	drawFormatInfo,
	drawTimingPatterns,
	drawVersionInfo,
	placeCodewords,
	QR_TIMING_LINE,
} from "../qr-function-patterns";
import { QrModuleGrid } from "../qr-module-grid";
import { qrSizeForVersion, rawDataModules } from "../qr-version-table";

/** A square region of the grid as rows of `1`/`0`. */
function region(grid: QrModuleGrid, top: number, left: number, size: number): string[] {
	return Array.from({ length: size }, (_: undefined, row: number): string =>
		Array.from({ length: size }, (__: undefined, column: number): string => (grid.isDark(top + row, left + column) ? "1" : "0")).join(""),
	);
}

/** Reads `count` bits (bit 0 first) from the given module positions. */
function readBits(grid: QrModuleGrid, positions: readonly (readonly [row: number, column: number])[]): number {
	return positions.reduce((value: number, [row, column]: readonly [number, number], bit: number): number => value | ((grid.isDark(row, column) ? 1 : 0) << bit), 0);
}

/** Every data (non-function) module of a grid. */
function countDataModules(grid: QrModuleGrid): number {
	let count = 0;
	for (let row = 0; row < grid.size; row += 1) for (let column = 0; column < grid.size; column += 1) if (!grid.isFunction(row, column)) count += 1;
	return count;
}

const FINDER_WITH_SEPARATOR: readonly string[] = ["11111110", "10000010", "10111010", "10111010", "10111010", "10000010", "11111110", "00000000"];

describe("drawTimingPatterns", () => {
	it("alternates dark and light along row 6 and column 6, starting dark", () => {
		const grid = new QrModuleGrid(21);
		drawTimingPatterns(grid);
		expect([0, 1, 2, 3, 20].map((position: number): boolean => grid.isDark(QR_TIMING_LINE, position))).toEqual([true, false, true, false, true]);
		expect([7, 8, 9].map((position: number): boolean => grid.isDark(position, QR_TIMING_LINE))).toEqual([false, true, false]);
		expect(grid.isFunction(QR_TIMING_LINE, 10)).toBe(true);
	});
});

describe("drawFinderPattern", () => {
	it("draws the 7×7 finder and its light separator, clipped at the symbol edge", () => {
		const grid = new QrModuleGrid(21);
		drawFinderPattern(grid, 3, 3);
		expect(region(grid, 0, 0, 8)).toEqual(FINDER_WITH_SEPARATOR);
		expect(grid.isFunction(7, 7)).toBe(true);
		expect(grid.isFunction(8, 8)).toBe(false);
	});
});

describe("drawAlignmentPattern(s)", () => {
	it("draws a 5×5 ring with a dark centre", () => {
		const grid = new QrModuleGrid(25);
		drawAlignmentPattern(grid, 18, 18);
		expect(region(grid, 16, 16, 5)).toEqual(["11111", "10001", "10101", "10001", "11111"]);
	});

	it("skips the three positions under the finders", () => {
		const grid = new QrModuleGrid(qrSizeForVersion(7));
		drawAlignmentPatterns(grid, 7);
		// Version 7 positions are 6, 22, 38: (6,6), (6,38) and (38,6) sit under finders.
		expect(grid.isFunction(6, 6)).toBe(false);
		expect(grid.isFunction(6, 38)).toBe(false);
		expect(grid.isFunction(38, 6)).toBe(false);
		expect([grid.isDark(22, 22), grid.isDark(6, 22), grid.isDark(38, 38)]).toEqual([true, true, true]);
	});

	it("draws none for version 1", () => {
		const grid = new QrModuleGrid(21);
		drawAlignmentPatterns(grid, 1);
		expect(grid.darkCount()).toBe(0);
	});
});

describe("drawFormatInfo", () => {
	const size = 21;
	const bits = qrFormatBits("Q", 6);
	const grid = new QrModuleGrid(size);
	drawFormatInfo(grid, bits);

	it("writes the first copy around the top-left finder (Figure 25)", () => {
		const positions: [number, number][] = [
			[0, 8],
			[1, 8],
			[2, 8],
			[3, 8],
			[4, 8],
			[5, 8],
			[7, 8],
			[8, 8],
			[8, 7],
			[8, 5],
			[8, 4],
			[8, 3],
			[8, 2],
			[8, 1],
			[8, 0],
		];
		expect(readBits(grid, positions)).toBe(bits);
	});

	it("writes the second copy under the top-right and beside the bottom-left finder", () => {
		const positions: [number, number][] = [
			[8, 20],
			[8, 19],
			[8, 18],
			[8, 17],
			[8, 16],
			[8, 15],
			[8, 14],
			[8, 13],
			[14, 8],
			[15, 8],
			[16, 8],
			[17, 8],
			[18, 8],
			[19, 8],
			[20, 8],
		];
		expect(readBits(grid, positions)).toBe(bits);
	});

	it("draws the always-dark module at (size − 8, 8)", () => {
		expect(grid.isDark(size - 8, 8)).toBe(true);
	});
});

describe("drawVersionInfo", () => {
	it("writes the 18 bits in both 6×3 blocks for version 7 and up", () => {
		const size = qrSizeForVersion(7);
		const grid = new QrModuleGrid(size);
		drawVersionInfo(grid, 7);
		const lowerLeft: [number, number][] = Array.from({ length: 18 }, (_: undefined, bit: number): [number, number] => [size - 11 + (bit % 3), Math.floor(bit / 3)]);
		const upperRight: [number, number][] = lowerLeft.map(([row, column]: [number, number]): [number, number] => [column, row]);
		expect(readBits(grid, lowerLeft)).toBe(qrVersionBits(7));
		expect(readBits(grid, upperRight)).toBe(qrVersionBits(7));
	});

	it("writes nothing below version 7", () => {
		const grid = new QrModuleGrid(qrSizeForVersion(6));
		drawVersionInfo(grid, 6);
		expect(grid.darkCount()).toBe(0);
	});
});

describe("buildFunctionPatterns", () => {
	it("reserves exactly the function modules, leaving the raw data modules free", () => {
		for (const version of [1, 2, 6, 7, 14, 32, 40]) {
			expect(countDataModules(buildFunctionPatterns(version, "M"))).toBe(rawDataModules(version));
		}
	});

	it("puts the three finders in the corners", () => {
		const grid = buildFunctionPatterns(2, "L");
		const size = grid.size;
		expect(region(grid, 0, 0, 7)).toEqual(region(grid, 0, size - 7, 7));
		expect(region(grid, 0, 0, 7)).toEqual(region(grid, size - 7, 0, 7));
	});
});

describe("placeCodewords", () => {
	it("starts at the bottom-right corner and moves upward in a two-module column", () => {
		const grid = buildFunctionPatterns(1, "M");
		// First codeword 0b1010_0000: bits go (20,20), (20,19), (19,20), (19,19), …
		placeCodewords(grid, [0b1010_0000]);
		expect([grid.isDark(20, 20), grid.isDark(20, 19), grid.isDark(19, 20), grid.isDark(19, 19)]).toEqual([true, false, true, false]);
	});

	it("fills every data module and never touches a function module", () => {
		const unmasked = buildFunctionPatterns(7, "M");
		const before = region(unmasked, 0, 0, 9);
		const allDark: number[] = Array.from({ length: Math.floor(rawDataModules(7) / 8) }, (): number => 0xff);
		placeCodewords(unmasked, allDark);
		expect(region(unmasked, 0, 0, 9)).toEqual(before);
		let darkData = 0;
		for (let row = 0; row < unmasked.size; row += 1)
			for (let column = 0; column < unmasked.size; column += 1) if (!unmasked.isFunction(row, column) && unmasked.isDark(row, column)) darkData += 1;
		expect(darkData).toBe(allDark.length * 8);
	});
});
