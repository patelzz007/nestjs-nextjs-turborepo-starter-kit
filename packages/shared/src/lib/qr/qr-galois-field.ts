/**
 * Arithmetic in GF(2⁸), the field QR's Reed–Solomon codes work in (ISO/IEC 18004 §7.5.2).
 * Elements are bytes; addition is XOR; multiplication is carry-less multiplication reduced
 * modulo the field's primitive polynomial x⁸ + x⁴ + x³ + x² + 1.
 */

/** x⁸ + x⁴ + x³ + x² + 1 — the QR field's primitive (reducing) polynomial, 0b1_0001_1101. */
export const QR_FIELD_PRIMITIVE_POLYNOMIAL = 0x11d;

/** Bits in one field element (a byte). */
const FIELD_ELEMENT_BITS = 8;

/** The highest bit an element can hold before it must be reduced. */
const FIELD_ELEMENT_TOP_BIT_SHIFT = FIELD_ELEMENT_BITS - 1;

/** The field's generator α = 2 (the polynomial `x`). */
export const QR_FIELD_GENERATOR = 2;

/** `left + right` in GF(2⁸): bitwise XOR (subtraction is the same operation). */
export function gfAdd(left: number, right: number): number {
	return left ^ right;
}

/**
 * `left × right` in GF(2⁸): Russian-peasant multiplication, most significant bit first,
 * reducing by {@link QR_FIELD_PRIMITIVE_POLYNOMIAL} whenever the product overflows a byte.
 * Both operands must be bytes (0–255).
 */
export function gfMultiply(left: number, right: number): number {
	let product = 0;
	for (let bit = FIELD_ELEMENT_TOP_BIT_SHIFT; bit >= 0; bit -= 1) {
		// Shift the running product one place (×x) and reduce if it left the byte…
		product = (product << 1) ^ ((product >>> FIELD_ELEMENT_TOP_BIT_SHIFT) * QR_FIELD_PRIMITIVE_POLYNOMIAL);
		// …then add `left` when this bit of `right` is set.
		product ^= ((right >>> bit) & 1) * left;
	}
	return product;
}

/** α^exponent in GF(2⁸) (exponent ≥ 0) — the roots of the Reed–Solomon generator polynomial. */
export function gfPower(exponent: number): number {
	let result = 1;
	for (let step = 0; step < exponent; step += 1) result = gfMultiply(result, QR_FIELD_GENERATOR);
	return result;
}
