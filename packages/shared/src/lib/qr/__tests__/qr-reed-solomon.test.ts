import { describe, expect, it } from "vitest";

import { reedSolomonGenerator, reedSolomonRemainder } from "../qr-reed-solomon";

/** "HELLO WORLD" as version 1-M data codewords (the widely published worked example). */
const HELLO_WORLD_1M_DATA: readonly number[] = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
const HELLO_WORLD_1M_ERROR_CORRECTION: readonly number[] = [196, 35, 39, 119, 235, 215, 231, 226, 93, 23];

describe("reedSolomonGenerator", () => {
	it("builds the degree-7 generator of ISO/IEC 18004 Annex A (α exponents 87, 229, 146, 149, 238, 102, 21)", () => {
		expect(reedSolomonGenerator(7)).toEqual([127, 122, 154, 164, 11, 68, 117]);
	});

	it("builds the degree-10 generator used by version 1-M", () => {
		expect(reedSolomonGenerator(10)).toEqual([216, 194, 159, 111, 199, 94, 95, 113, 157, 193]);
	});

	it("is x − 1 for degree 1 (only the constant term, 1, is kept)", () => {
		expect(reedSolomonGenerator(1)).toEqual([1]);
	});
});

describe("reedSolomonRemainder", () => {
	it("computes the error-correction codewords of the HELLO WORLD example", () => {
		expect(reedSolomonRemainder(HELLO_WORLD_1M_DATA, reedSolomonGenerator(10))).toEqual(HELLO_WORLD_1M_ERROR_CORRECTION);
	});

	it("is all zeros for all-zero data", () => {
		expect(reedSolomonRemainder([0, 0, 0, 0], reedSolomonGenerator(7))).toEqual([0, 0, 0, 0, 0, 0, 0]);
	});

	it("is all zeros for no data", () => {
		expect(reedSolomonRemainder([], reedSolomonGenerator(4))).toEqual([0, 0, 0, 0]);
	});
});
