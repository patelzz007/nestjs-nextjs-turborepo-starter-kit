import { describe, expect, it } from "vitest";

import { gfAdd, gfMultiply, gfPower, QR_FIELD_GENERATOR, QR_FIELD_PRIMITIVE_POLYNOMIAL } from "../qr-galois-field";

/** The multiplicative group of GF(256) has 255 elements, so α^255 = 1. */
const FIELD_ORDER = 255;

describe("gfAdd", () => {
	it("adds by XOR, so every element is its own negative", () => {
		expect(gfAdd(0b1010, 0b0110)).toBe(0b1100);
		expect(gfAdd(0x53, 0x53)).toBe(0);
		expect(gfAdd(0, 0xff)).toBe(0xff);
	});
});

describe("gfMultiply", () => {
	it("uses the QR primitive polynomial 0x11D", () => {
		expect(QR_FIELD_PRIMITIVE_POLYNOMIAL).toBe(0x11d);
		// x · x⁷ = x⁸ ≡ x⁴ + x³ + x² + 1 = 0x1D.
		expect(gfMultiply(QR_FIELD_GENERATOR, 0x80)).toBe(0x1d);
	});

	it("has 1 as identity and 0 as absorbing element", () => {
		for (const value of [0, 1, 0x1d, 0x80, 0xff]) {
			expect(gfMultiply(value, 1)).toBe(value);
			expect(gfMultiply(1, value)).toBe(value);
			expect(gfMultiply(value, 0)).toBe(0);
		}
	});

	it("is commutative and distributes over addition", () => {
		const samples = [0x02, 0x1d, 0x53, 0xca, 0xff];
		for (const left of samples) {
			for (const right of samples) {
				expect(gfMultiply(left, right)).toBe(gfMultiply(right, left));
				expect(gfMultiply(left, gfAdd(right, 0x0f))).toBe(gfAdd(gfMultiply(left, right), gfMultiply(left, 0x0f)));
			}
		}
	});

	it("matches known products of the QR field", () => {
		// α^25 = 3 and α^1 = 2, so 2 · 3 = α^26 = 6 (no reduction needed); 0x8E · 2 overflows and reduces.
		expect(gfMultiply(2, 3)).toBe(6);
		expect(gfMultiply(0x8e, 2)).toBe(0x01);
	});
});

describe("gfPower", () => {
	it("raises the generator α = 2", () => {
		expect(gfPower(0)).toBe(1);
		expect(gfPower(1)).toBe(2);
		expect(gfPower(8)).toBe(0x1d);
		expect(gfPower(25)).toBe(3);
	});

	it("cycles with period 255, visiting every non-zero element once", () => {
		expect(gfPower(FIELD_ORDER)).toBe(1);
		const elements = new Set(Array.from({ length: FIELD_ORDER }, (_: undefined, exponent: number): number => gfPower(exponent)));
		expect(elements.size).toBe(FIELD_ORDER);
		expect(elements.has(0)).toBe(false);
	});
});
