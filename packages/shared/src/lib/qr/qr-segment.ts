import { z } from "zod";

import { QrBitBuffer } from "./qr-bit-buffer";
import { encodeUtf8 } from "./qr-utf8";

/**
 * The data modes this encoder writes (ISO/IEC 18004 §7.4), densest first. Kanji and ECI are
 * not used: text that is neither numeric nor alphanumeric is written as UTF-8 bytes, which
 * every modern scanner reads.
 */
export const QrModeSchema = z.enum(["numeric", "alphanumeric", "byte"]);

export type QrMode = z.infer<typeof QrModeSchema>;

/** The 4-bit mode indicator that starts a segment (ISO/IEC 18004 Table 2). */
export const QR_MODE_INDICATOR: Readonly<Record<QrMode, number>> = { numeric: 0b0001, alphanumeric: 0b0010, byte: 0b0100 };

/** Bits in a mode indicator. */
export const QR_MODE_INDICATOR_BITS = 4;

/** Character-count field width per mode, for versions 1–9, 10–26 and 27–40 (ISO/IEC 18004 Table 3). */
const CHARACTER_COUNT_BITS: Readonly<Record<QrMode, readonly [small: number, medium: number, large: number]>> = {
	numeric: [10, 12, 14],
	alphanumeric: [9, 11, 13],
	byte: [8, 16, 16],
};

/** The last version of the small and medium character-count bands. */
const SMALL_VERSION_BAND_MAX = 9;
const MEDIUM_VERSION_BAND_MAX = 26;

/** Width of the character-count field for `mode` in `version`. */
export function characterCountBits(mode: QrMode, version: number): number {
	const [small, medium, large] = CHARACTER_COUNT_BITS[mode];
	if (version <= SMALL_VERSION_BAND_MAX) return small;
	if (version <= MEDIUM_VERSION_BAND_MAX) return medium;
	return large;
}

/** Every character alphanumeric mode can write, in code order (value 0 = "0", 44 = ":"). */
export const QR_ALPHANUMERIC_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

const NUMERIC_PATTERN = /^[0-9]*$/u;
const ALPHANUMERIC_PATTERN = /^[0-9A-Z $%*+\-./:]*$/u;

/** Numeric mode packs 3 digits into 10 bits, a trailing pair into 7 and a single digit into 4. */
const NUMERIC_GROUP_DIGITS = 3;
const NUMERIC_GROUP_BITS: Readonly<Record<number, number>> = { 1: 4, 2: 7, 3: 10 };

/** Alphanumeric mode packs a pair of characters into 11 bits (45·first + second) and a single one into 6. */
const ALPHANUMERIC_PAIR_BITS = 11;
const ALPHANUMERIC_SINGLE_BITS = 6;
const ALPHANUMERIC_RADIX = QR_ALPHANUMERIC_CHARSET.length;
const ALPHANUMERIC_PAIR_LENGTH = 2;

/** Bits in one byte-mode character. */
const BYTE_MODE_CHARACTER_BITS = 8;

/** One segment of the data stream: a mode, the number of characters the count field states, and the data bits. */
export interface QrSegment {
	readonly mode: QrMode;
	/** Digits, alphanumeric characters, or bytes — what the character-count field records. */
	readonly characterCount: number;
	readonly data: QrBitBuffer;
}

/** The densest single mode that can write all of `text`: numeric, then alphanumeric, else byte (UTF-8). */
export function selectQrMode(text: string): QrMode {
	if (NUMERIC_PATTERN.test(text)) return "numeric";
	if (ALPHANUMERIC_PATTERN.test(text)) return "alphanumeric";
	return "byte";
}

/** The alphanumeric code of `character` (its position in {@link QR_ALPHANUMERIC_CHARSET}). */
function alphanumericValue(character: string): number {
	// `indexOf("")` is 0, so an empty string must not reach the lookup as "0".
	const value = character.length === 1 ? QR_ALPHANUMERIC_CHARSET.indexOf(character) : -1;
	if (value < 0) throw new RangeError(`"${character}" cannot be written in alphanumeric mode`);
	return value;
}

/** A numeric-mode segment for a string of ASCII digits. */
export function makeNumericSegment(digits: string): QrSegment {
	if (!NUMERIC_PATTERN.test(digits)) throw new RangeError("A numeric segment takes digits only");
	const data = new QrBitBuffer();
	for (let start = 0; start < digits.length; start += NUMERIC_GROUP_DIGITS) {
		const group = digits.slice(start, start + NUMERIC_GROUP_DIGITS);
		const groupBits = NUMERIC_GROUP_BITS[group.length];
		if (groupBits === undefined) throw new RangeError(`Unexpected numeric group "${group}"`);
		data.appendBits(Number.parseInt(group, 10), groupBits);
	}
	return { mode: "numeric", characterCount: digits.length, data };
}

/** An alphanumeric-mode segment for text drawn from {@link QR_ALPHANUMERIC_CHARSET}. */
export function makeAlphanumericSegment(text: string): QrSegment {
	if (!ALPHANUMERIC_PATTERN.test(text)) throw new RangeError("An alphanumeric segment takes 0-9, A-Z, space and $%*+-./: only");
	const data = new QrBitBuffer();
	for (let start = 0; start < text.length; start += ALPHANUMERIC_PAIR_LENGTH) {
		const first = alphanumericValue(text.charAt(start));
		const isLastSingle = start + ALPHANUMERIC_PAIR_LENGTH > text.length;
		if (isLastSingle) data.appendBits(first, ALPHANUMERIC_SINGLE_BITS);
		else data.appendBits(first * ALPHANUMERIC_RADIX + alphanumericValue(text.charAt(start + 1)), ALPHANUMERIC_PAIR_BITS);
	}
	return { mode: "alphanumeric", characterCount: text.length, data };
}

/** A byte-mode segment holding `text` as UTF-8. */
export function makeByteSegment(text: string): QrSegment {
	const bytes = encodeUtf8(text);
	const data = new QrBitBuffer();
	for (const byte of bytes) data.appendBits(byte, BYTE_MODE_CHARACTER_BITS);
	return { mode: "byte", characterCount: bytes.length, data };
}

/** `text` as one segment in the densest mode that fits all of it (see {@link selectQrMode}). */
export function makeSegment(text: string): QrSegment {
	switch (selectQrMode(text)) {
		case "numeric":
			return makeNumericSegment(text);
		case "alphanumeric":
			return makeAlphanumericSegment(text);
		case "byte":
			return makeByteSegment(text);
	}
}

/**
 * Bits `segments` take in `version` (mode indicators + count fields + data), or `undefined`
 * when a segment has more characters than its count field can state in that version.
 */
export function segmentsBitLength(segments: readonly QrSegment[], version: number): number | undefined {
	let total = 0;
	for (const segment of segments) {
		const countBits = characterCountBits(segment.mode, version);
		if (segment.characterCount >= 2 ** countBits) return undefined;
		total += QR_MODE_INDICATOR_BITS + countBits + segment.data.length;
	}
	return total;
}
