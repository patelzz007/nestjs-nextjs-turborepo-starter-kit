import { describe, expect, it } from "vitest";

import { qrFormatBits } from "../qr-format-info";
import { buildFunctionPatterns, placeCodewords } from "../qr-function-patterns";
import {
	applyMask,
	isMaskedModule,
	maskPenalty,
	penaltyAdjacentRuns,
	penaltyDarkBalance,
	penaltyFinderLikePatterns,
	penaltySameColourBlocks,
	QR_MASKS,
	QrMaskSchema,
	selectBestMask,
	withMask,
} from "../qr-mask";
import { QrModuleGrid } from "../qr-module-grid";

/** A grid drawn from rows of `1` (dark) and `0` (light), all data modules. */
function gridFromRows(rows: readonly string[]): QrModuleGrid {
	const grid = new QrModuleGrid(rows.length);
	rows.forEach((line: string, row: number): void => {
		Array.from(line).forEach((cell: string, column: number): void => {
			grid.setDataModule(row, column, cell === "1");
		});
	});
	return grid;
}

/** A 7×7 checkerboard: no runs, no blocks, no finder-like windows, 25 of 49 dark. */
const CHECKERBOARD: readonly string[] = ["1010101", "0101010", "1010101", "0101010", "1010101", "0101010", "1010101"];

describe("QrMaskSchema and QR_MASKS", () => {
	it("allows the masks 0–7 only", () => {
		expect(QR_MASKS).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
		expect(QrMaskSchema.safeParse(7).success).toBe(true);
		expect(QrMaskSchema.safeParse(8).success).toBe(false);
		expect(QrMaskSchema.safeParse(1.5).success).toBe(false);
	});
});

describe("isMaskedModule", () => {
	it("evaluates each condition of ISO/IEC 18004 Table 10 (i = row, j = column)", () => {
		expect([isMaskedModule(0, 0, 0), isMaskedModule(0, 0, 1)]).toEqual([true, false]);
		expect([isMaskedModule(1, 2, 5), isMaskedModule(1, 3, 0)]).toEqual([true, false]);
		expect([isMaskedModule(2, 5, 3), isMaskedModule(2, 0, 1)]).toEqual([true, false]);
		expect([isMaskedModule(3, 1, 2), isMaskedModule(3, 1, 1)]).toEqual([true, false]);
		expect([isMaskedModule(4, 1, 2), isMaskedModule(4, 2, 0)]).toEqual([true, false]);
		expect([isMaskedModule(5, 0, 7), isMaskedModule(5, 1, 1)]).toEqual([true, false]);
		expect([isMaskedModule(6, 1, 1), isMaskedModule(6, 1, 5)]).toEqual([true, false]);
		expect([isMaskedModule(7, 0, 0), isMaskedModule(7, 0, 1)]).toEqual([true, false]);
	});

	it("rejects a mask that does not exist", () => {
		expect(() => isMaskedModule(8, 0, 0)).toThrow(RangeError);
	});
});

describe("applyMask", () => {
	it("inverts the selected data modules, leaves function modules alone, and undoes itself", () => {
		const grid = new QrModuleGrid(3);
		grid.setFunctionModule(0, 0, false);
		applyMask(grid, 0);
		expect(grid.isDark(0, 0)).toBe(false);
		expect([grid.isDark(1, 1), grid.isDark(0, 1), grid.isDark(2, 2)]).toEqual([true, false, true]);
		applyMask(grid, 0);
		expect(grid.darkCount()).toBe(0);
	});
});

describe("penalty rules", () => {
	it("scores nothing on a balanced checkerboard", () => {
		const grid = gridFromRows(CHECKERBOARD);
		expect([penaltyAdjacentRuns(grid), penaltySameColourBlocks(grid), penaltyFinderLikePatterns(grid), penaltyDarkBalance(grid)]).toEqual([0, 0, 0, 0]);
	});

	it("rule 1: scores 3 + (run − 5) for each run of five or more, in rows and columns", () => {
		// Row 0 has a run of 7 dark (3 + 2); every column then has runs of 1, row 1–6 alternate.
		const rows = ["1111111", "0101010", "1010101", "0101010", "1010101", "0101010", "1010101"];
		expect(penaltyAdjacentRuns(gridFromRows(rows))).toBe(5);
		expect(penaltyAdjacentRuns(gridFromRows(["11111", "00000", "11111", "00000", "11111"]))).toBe(5 * 3);
	});

	it("rule 2: scores 3 per 2×2 single-colour block, overlapping blocks included", () => {
		expect(penaltySameColourBlocks(gridFromRows(["110", "110", "110"]))).toBe(3 * 2);
		expect(penaltySameColourBlocks(gridFromRows(["111", "111", "111"]))).toBe(3 * 4);
	});

	it("rule 3: scores 40 per finder-like 1011101 with four light modules on one side, in rows and columns", () => {
		const rows = ["10111010000", ...Array.from({ length: 10 }, (_: undefined, index: number): string => (index % 2 === 0 ? "01010101010" : "10101010101"))];
		expect(penaltyFinderLikePatterns(gridFromRows(rows))).toBe(40);
		const mirrored = ["00001011101", ...rows.slice(1)];
		expect(penaltyFinderLikePatterns(gridFromRows(mirrored))).toBe(40);
	});

	it("rule 4: scores 10 per full 5 % step outside 45–55 % dark", () => {
		const share = (dark: number): QrModuleGrid => {
			// A 10×10 data area holds 100 modules, so `dark` modules is `dark` %.
			const grid = new QrModuleGrid(10);
			for (let index = 0; index < dark; index += 1) grid.setDataModule(Math.floor(index / 10), index % 10, true);
			return grid;
		};
		expect([50, 45, 55, 44, 56, 40, 60, 39, 0, 100].map((percent: number): number => penaltyDarkBalance(share(percent)))).toEqual([0, 0, 0, 10, 10, 10, 10, 20, 90, 90]);
	});

	it("adds the four rules up", () => {
		const grid = gridFromRows(["11111", "11111", "00000", "00000", "11111"]);
		expect(maskPenalty(grid)).toBe(penaltyAdjacentRuns(grid) + penaltySameColourBlocks(grid) + penaltyFinderLikePatterns(grid) + penaltyDarkBalance(grid));
	});
});

describe("withMask", () => {
	it("masks a copy and draws that mask's format information, leaving the input untouched", () => {
		const unmasked = buildFunctionPatterns(1, "L");
		placeCodewords(
			unmasked,
			Array.from({ length: 26 }, (): number => 0),
		);
		const masked = withMask(unmasked, "L", 3);
		const bits = qrFormatBits("L", 3);
		// Format bit 0 sits at (0, 8) and bit 14 at (8, 0).
		expect(masked.isDark(0, 8)).toBe((bits & 1) === 1);
		expect(masked.isDark(8, 0)).toBe(((bits >>> 14) & 1) === 1);
		expect(unmasked.isDark(20, 20)).toBe(false);
		expect(masked.isDark(20, 20)).toBe(isMaskedModule(3, 20, 20));
	});
});

describe("selectBestMask", () => {
	it("picks the mask with the lowest total penalty, the lower number on a tie", () => {
		const unmasked = buildFunctionPatterns(2, "M");
		placeCodewords(
			unmasked,
			Array.from({ length: 44 }, (_: undefined, index: number): number => (index * 37) % 256),
		);
		const penalties = QR_MASKS.map((mask): number => maskPenalty(withMask(unmasked, "M", mask)));
		const lowest = Math.min(...penalties);
		expect(selectBestMask(unmasked, "M")).toBe(penalties.indexOf(lowest));
	});
});
