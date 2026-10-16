import { describe, expect, it } from "vitest";

import { QR_ERROR_CORRECTION_LEVELS } from "./qr-error-correction";
import {
	alignmentPatternPositions,
	dataCodewords,
	ecBlockCount,
	ecCodewordsPerBlock,
	MAX_QR_VERSION,
	MIN_QR_VERSION,
	qrSizeForVersion,
	rawDataModules,
	totalCodewords,
} from "./qr-version-table";

const ALL_VERSIONS: readonly number[] = Array.from({ length: MAX_QR_VERSION }, (_: undefined, index: number): number => MIN_QR_VERSION + index);

describe("qrSizeForVersion", () => {
	it("is 21 modules for version 1 and grows by 4 per version to 177", () => {
		expect(qrSizeForVersion(1)).toBe(21);
		expect(qrSizeForVersion(2)).toBe(25);
		expect(qrSizeForVersion(40)).toBe(177);
	});
});

describe("alignmentPatternPositions", () => {
	it("matches ISO/IEC 18004 Annex E", () => {
		expect(alignmentPatternPositions(1)).toEqual([]);
		expect(alignmentPatternPositions(2)).toEqual([6, 18]);
		expect(alignmentPatternPositions(6)).toEqual([6, 34]);
		expect(alignmentPatternPositions(7)).toEqual([6, 22, 38]);
		expect(alignmentPatternPositions(14)).toEqual([6, 26, 46, 66]);
		expect(alignmentPatternPositions(32)).toEqual([6, 34, 60, 86, 112, 138]);
		expect(alignmentPatternPositions(36)).toEqual([6, 24, 50, 76, 102, 128, 154]);
		expect(alignmentPatternPositions(40)).toEqual([6, 30, 58, 86, 114, 142, 170]);
	});

	it("always ends 7 modules in from the far edge", () => {
		for (const version of ALL_VERSIONS.filter((candidate: number): boolean => candidate > 1)) {
			expect(alignmentPatternPositions(version).at(-1)).toBe(qrSizeForVersion(version) - 7);
		}
	});
});

describe("rawDataModules and totalCodewords", () => {
	it("match the codeword totals of ISO/IEC 18004 Table 1", () => {
		expect(totalCodewords(1)).toBe(26);
		expect(totalCodewords(2)).toBe(44);
		expect(totalCodewords(7)).toBe(196);
		expect(totalCodewords(10)).toBe(346);
		expect(totalCodewords(40)).toBe(3706);
	});

	it("leave the standard's remainder bits (e.g. 0 for version 1, 7 for version 2, 0 for version 7)", () => {
		expect(rawDataModules(1) % 8).toBe(0);
		expect(rawDataModules(2) % 8).toBe(7);
		expect(rawDataModules(7) % 8).toBe(0);
		expect(rawDataModules(14) % 8).toBe(3);
	});
});

describe("error-correction tables", () => {
	it("give known block layouts", () => {
		expect([ecCodewordsPerBlock(1, "M"), ecBlockCount(1, "M")]).toEqual([10, 1]);
		expect([ecCodewordsPerBlock(5, "Q"), ecBlockCount(5, "Q")]).toEqual([18, 4]);
		expect([ecCodewordsPerBlock(40, "H"), ecBlockCount(40, "H")]).toEqual([30, 81]);
	});

	it("give the data capacities of Table 7", () => {
		expect(QR_ERROR_CORRECTION_LEVELS.map((level) => dataCodewords(1, level))).toEqual([19, 16, 13, 9]);
		expect(QR_ERROR_CORRECTION_LEVELS.map((level) => dataCodewords(40, level))).toEqual([2956, 2334, 1666, 1276]);
	});

	it("never assign more error correction than there are codewords, and capacity only grows with the version", () => {
		for (const level of QR_ERROR_CORRECTION_LEVELS) {
			let previous = 0;
			for (const version of ALL_VERSIONS) {
				const capacity = dataCodewords(version, level);
				expect(capacity).toBeGreaterThan(previous);
				previous = capacity;
			}
		}
	});

	it("throws a table lookup error outside versions 1–40", () => {
		expect(() => ecBlockCount(41, "L")).toThrow(/ec-block-count/u);
		expect(() => ecCodewordsPerBlock(0, "H")).toThrow(/ec-codewords-per-block/u);
	});
});
