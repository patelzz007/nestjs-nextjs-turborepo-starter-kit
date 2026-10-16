import { gfAdd, gfMultiply, gfPower } from "./qr-galois-field";
import { readTableEntry } from "./qr-table";

/** Where the leading (highest-degree) term sits in a coefficient list. */
const LEADING_TERM_INDEX = 0;

/** A coefficient past the lowest-degree term: the polynomial has no such term, so it is zero. */
const ABSENT_TERM_COEFFICIENT = 0;

/**
 * The Reed–Solomon generator polynomial of `degree` — ∏ (x − αⁱ) for i = 0…degree−1
 * (ISO/IEC 18004 §7.5.2, Annex A) — as its coefficients from x^(degree−1) down to x⁰.
 * The leading coefficient (always 1) is left out, as the remainder division needs.
 */
export function reedSolomonGenerator(degree: number): readonly number[] {
	// Start from the constant polynomial 1, written as `degree` coefficients.
	let coefficients: readonly number[] = Array.from({ length: degree }, (_: undefined, index: number): number => (index === degree - 1 ? 1 : 0));
	for (let rootExponent = 0; rootExponent < degree; rootExponent += 1) {
		const root = gfPower(rootExponent);
		const previous = coefficients;
		// Multiply by (x − root): each coefficient becomes c·root + the next-lower coefficient.
		coefficients = previous.map((coefficient: number, index: number): number => gfAdd(gfMultiply(coefficient, root), previous[index + 1] ?? ABSENT_TERM_COEFFICIENT));
	}
	return coefficients;
}

/**
 * The Reed–Solomon error-correction codewords for `data`: the remainder of
 * data(x)·x^degree divided by the generator (polynomial long division in GF(2⁸)).
 * `generator` comes from {@link reedSolomonGenerator}; the result has the same length.
 */
export function reedSolomonRemainder(data: readonly number[], generator: readonly number[]): readonly number[] {
	let remainder: readonly number[] = generator.map((): number => ABSENT_TERM_COEFFICIENT);
	for (const dataByte of data) {
		const factor = gfAdd(dataByte, readTableEntry(remainder, LEADING_TERM_INDEX, "reed-solomon remainder"));
		const previous = remainder;
		// Shift the remainder one term left and subtract factor × generator.
		remainder = generator.map((coefficient: number, index: number): number => gfAdd(previous[index + 1] ?? ABSENT_TERM_COEFFICIENT, gfMultiply(coefficient, factor)));
	}
	return remainder;
}
