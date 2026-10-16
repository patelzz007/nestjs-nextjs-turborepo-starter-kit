/**
 * UTF-8 encoding written out by hand (RFC 3629), so the encoder needs no `TextEncoder` —
 * it runs unchanged in browsers, Node and Hermes (React Native).
 */

/** Highest code point of each UTF-8 sequence length: 1, 2 and 3 bytes (4 bytes cover the rest). */
const ONE_BYTE_MAX_CODE_POINT = 0x7f;
const TWO_BYTE_MAX_CODE_POINT = 0x7ff;
const THREE_BYTE_MAX_CODE_POINT = 0xffff;

/** The surrogate range: a lone surrogate is not a scalar value, so it is encoded as U+FFFD (as `TextEncoder` does). */
const SURROGATE_MIN = 0xd800;
const SURROGATE_MAX = 0xdfff;
const REPLACEMENT_CHARACTER = 0xfffd;

/** Lead-byte markers of the 2-, 3- and 4-byte sequences, and the continuation-byte marker. */
const TWO_BYTE_LEAD = 0xc0;
const THREE_BYTE_LEAD = 0xe0;
const FOUR_BYTE_LEAD = 0xf0;
const CONTINUATION_MARKER = 0x80;

/** Payload bits in a continuation byte, and the mask selecting them. */
const CONTINUATION_PAYLOAD_BITS = 6;
const CONTINUATION_PAYLOAD_MASK = 0x3f;

/** A code point above the Basic Multilingual Plane takes two UTF-16 code units (a surrogate pair). */
const SUPPLEMENTARY_CODE_UNITS = 2;
const BMP_CODE_UNITS = 1;

/** The continuation byte carrying bits `shift`…`shift + 5` of `codePoint`. */
function continuationByte(codePoint: number, shift: number): number {
	return CONTINUATION_MARKER | ((codePoint >>> shift) & CONTINUATION_PAYLOAD_MASK);
}

/** The UTF-8 bytes of one Unicode scalar value. */
export function encodeUtf8CodePoint(codePoint: number): number[] {
	if (codePoint <= ONE_BYTE_MAX_CODE_POINT) return [codePoint];
	if (codePoint <= TWO_BYTE_MAX_CODE_POINT) return [TWO_BYTE_LEAD | (codePoint >>> CONTINUATION_PAYLOAD_BITS), continuationByte(codePoint, 0)];
	if (codePoint <= THREE_BYTE_MAX_CODE_POINT) {
		return [THREE_BYTE_LEAD | (codePoint >>> (2 * CONTINUATION_PAYLOAD_BITS)), continuationByte(codePoint, CONTINUATION_PAYLOAD_BITS), continuationByte(codePoint, 0)];
	}
	return [
		FOUR_BYTE_LEAD | (codePoint >>> (3 * CONTINUATION_PAYLOAD_BITS)),
		continuationByte(codePoint, 2 * CONTINUATION_PAYLOAD_BITS),
		continuationByte(codePoint, CONTINUATION_PAYLOAD_BITS),
		continuationByte(codePoint, 0),
	];
}

/** `text` as UTF-8 bytes. A lone (unpaired) surrogate becomes U+FFFD, matching `TextEncoder`. */
export function encodeUtf8(text: string): number[] {
	const bytes: number[] = [];
	let index = 0;
	while (index < text.length) {
		const codePoint = text.codePointAt(index);
		if (codePoint === undefined) break;
		const isLoneSurrogate = codePoint >= SURROGATE_MIN && codePoint <= SURROGATE_MAX;
		bytes.push(...encodeUtf8CodePoint(isLoneSurrogate ? REPLACEMENT_CHARACTER : codePoint));
		index += codePoint > THREE_BYTE_MAX_CODE_POINT ? SUPPLEMENTARY_CODE_UNITS : BMP_CODE_UNITS;
	}
	return bytes;
}
