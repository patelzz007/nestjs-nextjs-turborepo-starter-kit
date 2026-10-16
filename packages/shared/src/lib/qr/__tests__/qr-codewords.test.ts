import { describe, expect, it } from "vitest";

import { addErrorCorrectionAndInterleave, buildDataCodewords } from "./qr-codewords";
import { reedSolomonGenerator, reedSolomonRemainder } from "./qr-reed-solomon";
import { makeAlphanumericSegment, makeByteSegment } from "./qr-segment";
import { dataCodewords, totalCodewords } from "./qr-version-table";

/** "HELLO WORLD" as version 1-M data codewords (the widely published worked example). */
const HELLO_WORLD_1M_DATA: readonly number[] = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];

describe("buildDataCodewords", () => {
	it("writes mode, count, data, terminator, bit padding and alternating pad codewords", () => {
		expect(buildDataCodewords([makeAlphanumericSegment("HELLO WORLD")], 1, "M")).toEqual(HELLO_WORLD_1M_DATA);
	});

	it("fills the capacity with pad codewords for no segments", () => {
		const codewords = buildDataCodewords([], 1, "L");
		expect(codewords).toHaveLength(dataCodewords(1, "L"));
		expect(codewords.slice(0, 3)).toEqual([0x00, 0xec, 0x11]);
	});

	it("shortens the terminator when the data almost fills the symbol", () => {
		// Version 1-H holds 72 data bits; 4 + 8 + 7 × 8 = 68 leaves room for exactly 4 terminator bits.
		const codewords = buildDataCodewords([makeByteSegment("abcdefg")], 1, "H");
		expect(codewords).toHaveLength(9);
		expect(codewords.at(-1)).toBe((0x67 & 0x0f) << 4);
	});

	it("rejects segments that do not fit", () => {
		expect(() => buildDataCodewords([makeByteSegment("a".repeat(20))], 1, "L")).toThrow(RangeError);
	});
});

describe("addErrorCorrectionAndInterleave", () => {
	it("appends the error correction after the data for a single-block symbol", () => {
		const generator = reedSolomonGenerator(10);
		expect(addErrorCorrectionAndInterleave(HELLO_WORLD_1M_DATA, 1, "M")).toEqual([...HELLO_WORLD_1M_DATA, ...reedSolomonRemainder(HELLO_WORLD_1M_DATA, generator)]);
	});

	it("interleaves short and long blocks (version 5-Q: 2 blocks of 15 and 2 of 16 data codewords)", () => {
		const data = Array.from({ length: dataCodewords(5, "Q") }, (_: undefined, index: number): number => index);
		const result = addErrorCorrectionAndInterleave(data, 5, "Q");
		expect(result).toHaveLength(totalCodewords(5));
		// First column: the first codeword of each block (blocks start at 0, 15, 30, 46).
		expect(result.slice(0, 4)).toEqual([0, 15, 30, 46]);
		// The 16th data codeword exists only in the two long blocks.
		expect(result.slice(4 * 15, 4 * 15 + 2)).toEqual([45, 61]);
		// Then the error correction, interleaved the same way.
		const generator = reedSolomonGenerator(18);
		const [firstEc] = reedSolomonRemainder(data.slice(0, 15), generator);
		const [secondEc] = reedSolomonRemainder(data.slice(15, 30), generator);
		expect(result.slice(62, 64)).toEqual([firstEc, secondEc]);
	});
});
