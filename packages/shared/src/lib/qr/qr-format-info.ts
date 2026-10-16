import { QR_ERROR_CORRECTION_FORMAT_BITS, type QrErrorCorrectionLevel } from "./qr-error-correction";

/**
 * BCH codes protecting the format and version information (ISO/IEC 18004 §7.9, §7.10,
 * Annexes C and D).
 */

/** Format information: 5 data bits (2 level + 3 mask) extended by a (15, 5) BCH code. */
const FORMAT_DATA_BITS = 5;
const FORMAT_MASK_BITS = 3;
const FORMAT_ECC_BITS = 10;
/** x¹⁰ + x⁸ + x⁵ + x⁴ + x² + x + 1 — the format BCH generator. */
const FORMAT_GENERATOR_POLYNOMIAL = 0x537;
/** XOR mask that keeps the format bits from ever being all zero (0b101010000010010). */
export const QR_FORMAT_INFO_MASK = 0x5412;

/** Bits in the format information string. */
export const QR_FORMAT_INFO_BITS = FORMAT_DATA_BITS + FORMAT_ECC_BITS;

/** Version information: the 6-bit version extended by an (18, 6) BCH code. */
const VERSION_DATA_BITS = 6;
const VERSION_ECC_BITS = 12;
/** x¹² + x¹¹ + x¹⁰ + x⁹ + x⁸ + x⁵ + x² + 1 — the version BCH generator. */
const VERSION_GENERATOR_POLYNOMIAL = 0x1f25;

/** Bits in the version information string. */
export const QR_VERSION_INFO_BITS = VERSION_DATA_BITS + VERSION_ECC_BITS;

/** `data` followed by its BCH remainder: the polynomial division of data·x^eccBits by `generator`. */
function bchEncode(data: number, eccBits: number, generator: number): number {
	let remainder = data;
	for (let step = 0; step < eccBits; step += 1) remainder = (remainder << 1) ^ ((remainder >>> (eccBits - 1)) * generator);
	return (data << eccBits) | remainder;
}

/**
 * The 15-bit format information for `level` and `mask` (0–7), masked with
 * {@link QR_FORMAT_INFO_MASK} — e.g. `M` with mask 0 is `0x5412 ^ 0` = 0b101010000010010.
 */
export function qrFormatBits(level: QrErrorCorrectionLevel, mask: number): number {
	const data = (QR_ERROR_CORRECTION_FORMAT_BITS[level] << FORMAT_MASK_BITS) | mask;
	return bchEncode(data, FORMAT_ECC_BITS, FORMAT_GENERATOR_POLYNOMIAL) ^ QR_FORMAT_INFO_MASK;
}

/** The 18-bit version information for `version` (7–40) — e.g. version 7 is `0x07C94`. */
export function qrVersionBits(version: number): number {
	return bchEncode(version, VERSION_ECC_BITS, VERSION_GENERATOR_POLYNOMIAL);
}
