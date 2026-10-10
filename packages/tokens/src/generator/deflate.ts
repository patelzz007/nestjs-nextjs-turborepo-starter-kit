// ============================================
// generator/deflate.ts — a small, deterministic DEFLATE compressor
// ============================================
// For the generated PNGs (RFC 1951). Node's zlib is not used: its output can
// differ between Node versions and CPUs, and the committed icons must be
// byte-identical everywhere for the staleness test. Icons are flat colour, so
// a greedy matcher that only looks one pixel back and one scanline up — with
// the fixed Huffman codes, in a single block — shrinks them by orders of
// magnitude while staying a few dozen lines.

/** RFC 1951 §3.2.5: the base match length of length codes 257–285, and their extra bits. */
const LENGTH_BASES = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LENGTH_EXTRA_BITS = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
/** RFC 1951 §3.2.5: the base distance of distance codes 0–29, and their extra bits. */
const DISTANCE_BASES = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12_289, 16_385, 24_577];
const DISTANCE_EXTRA_BITS = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];

const MIN_MATCH = 3;
const MAX_MATCH = 258;
/** The DEFLATE window: no match may reach further back. */
const MAX_DISTANCE = 32_768;
const END_OF_BLOCK = 256;
const FIRST_LENGTH_CODE = 257;
/** Block header: BFINAL = 1, BTYPE = 01 (fixed Huffman codes). */
const FINAL_BLOCK = 1;
const FIXED_HUFFMAN = 1;
const BLOCK_TYPE_BITS = 2;
const DISTANCE_CODE_BITS = 5;
const BITS_PER_BYTE = 8;

/** Fixed literal/length codes (RFC 1951 §3.2.6): [first symbol, code of that symbol, code length]. */
const FIXED_CODE_RANGES: readonly (readonly [number, number, number])[] = [
	[0, 0b0011_0000, 8],
	[144, 0b1_1001_0000, 9],
	[256, 0b000_0000, 7],
	[280, 0b1100_0000, 8],
];

/** Writes bits least-significant first, as DEFLATE packs them. */
class BitWriter {
	private readonly _bytes: number[] = [];
	private _current = 0;
	private _filled = 0;

	public write(value: number, bitCount: number): void {
		for (let bit = 0; bit < bitCount; bit += 1) {
			this._current |= ((value >>> bit) & 1) << this._filled;
			this._filled += 1;
			if (this._filled === BITS_PER_BYTE) {
				this._bytes.push(this._current);
				this._current = 0;
				this._filled = 0;
			}
		}
	}

	/** Huffman codes are packed most-significant bit first. */
	public writeCode(code: number, length: number): void {
		for (let bit = length - 1; bit >= 0; bit -= 1) {
			this.write((code >>> bit) & 1, 1);
		}
	}

	public finish(): Uint8Array {
		if (this._filled > 0) {
			this._bytes.push(this._current);
		}
		return Uint8Array.from(this._bytes);
	}
}

function writeSymbol(writer: BitWriter, symbol: number): void {
	const range = [...FIXED_CODE_RANGES].reverse().find(([first]) => symbol >= first);
	const [first = 0, base = 0, length = 0] = range ?? [];
	writer.writeCode(base + symbol - first, length);
}

/** The index of the last table entry whose base is at most `value`. */
function codeIndexFor(bases: readonly number[], value: number): number {
	let index = 0;
	while (index + 1 < bases.length && (bases[index + 1] ?? Number.POSITIVE_INFINITY) <= value) {
		index += 1;
	}
	return index;
}

function writeMatch(writer: BitWriter, length: number, distance: number): void {
	const lengthIndex = codeIndexFor(LENGTH_BASES, length);
	writeSymbol(writer, FIRST_LENGTH_CODE + lengthIndex);
	writer.write(length - (LENGTH_BASES[lengthIndex] ?? 0), LENGTH_EXTRA_BITS[lengthIndex] ?? 0);
	const distanceIndex = codeIndexFor(DISTANCE_BASES, distance);
	writer.writeCode(distanceIndex, DISTANCE_CODE_BITS);
	writer.write(distance - (DISTANCE_BASES[distanceIndex] ?? 0), DISTANCE_EXTRA_BITS[distanceIndex] ?? 0);
}

function matchLength(bytes: Uint8Array, position: number, distance: number): number {
	if (distance > position || distance > MAX_DISTANCE) {
		return 0;
	}
	let length = 0;
	while (length < MAX_MATCH && position + length < bytes.length && bytes[position + length] === bytes[position + length - distance]) {
		length += 1;
	}
	return length;
}

/**
 * `bytes` as one fixed-Huffman DEFLATE block. `distances` are the only
 * back-references tried at each position (for an image: one pixel back, one
 * scanline up); the longest match of at least 3 bytes wins, otherwise a literal.
 */
export function deflateFixed(bytes: Uint8Array, distances: readonly number[]): Uint8Array {
	const writer = new BitWriter();
	writer.write(FINAL_BLOCK, 1);
	writer.write(FIXED_HUFFMAN, BLOCK_TYPE_BITS);
	let position = 0;
	while (position < bytes.length) {
		let bestLength = 0;
		let bestDistance = 0;
		for (const distance of distances) {
			const length = matchLength(bytes, position, distance);
			if (length > bestLength) {
				bestLength = length;
				bestDistance = distance;
			}
		}
		if (bestLength >= MIN_MATCH) {
			writeMatch(writer, bestLength, bestDistance);
			position += bestLength;
		} else {
			writeSymbol(writer, bytes[position] ?? 0);
			position += 1;
		}
	}
	writeSymbol(writer, END_OF_BLOCK);
	return writer.finish();
}
