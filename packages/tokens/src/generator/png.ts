// ============================================
// generator/png.ts — RGBA pixels → a PNG file
// ============================================
// A minimal, dependency-free PNG writer for the generated icons. The image
// data is compressed by deflate.ts — deterministic, unlike Node's zlib — so
// the bytes depend on nothing but the pixels: the committed icons are
// identical on every machine and Node version, and the staleness test can
// compare them byte for byte.

import { deflateFixed } from "./deflate";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const BYTES_PER_PIXEL = 4;
const BIT_DEPTH = 8;
/** Colour type 6: truecolour with alpha (RGBA). */
const COLOR_TYPE_RGBA = 6;
const COMPRESSION_DEFLATE = 0;
const FILTER_METHOD_ADAPTIVE = 0;
const INTERLACE_NONE = 0;
/** Each scanline starts with its filter type; 0 = none. */
const FILTER_NONE = 0;

/** zlib header: deflate, 32 KB window, no preset dictionary (FCHECK makes it a multiple of 31). */
const ZLIB_HEADER = [0x78, 0x01];
const ADLER_MODULUS = 65_521;
const BYTE_MASK = 0xff;
const BITS_PER_BYTE = 8;
const BYTES_PER_UINT32 = 4;
/** A chunk: length (4) + type (4) + data + CRC (4). */
const CHUNK_OVERHEAD = 12;
const CHUNK_TYPE_LENGTH = 4;
const CRC_POLYNOMIAL = 0xedb8_8320;
const CRC_TABLE_SIZE = 256;
const CRC_INITIAL = 0xffff_ffff;
/** Chunk types are four ASCII letters ("IHDR", "IDAT", "IEND"). */
const TEXT_ENCODER = new TextEncoder();

/** The CRC-32 table (PNG specification, annex D). */
const CRC_TABLE: Uint32Array = Uint32Array.from({ length: CRC_TABLE_SIZE }, (_entry: undefined, index: number): number => {
	let crc = index;
	for (let bit = 0; bit < BITS_PER_BYTE; bit += 1) {
		crc = crc & 1 ? CRC_POLYNOMIAL ^ (crc >>> 1) : crc >>> 1;
	}
	return crc >>> 0;
});

function crc32(bytes: Uint8Array): number {
	let crc = CRC_INITIAL;
	for (const byte of bytes) {
		crc = (CRC_TABLE[(crc ^ byte) & BYTE_MASK] ?? 0) ^ (crc >>> BITS_PER_BYTE);
	}
	return (crc ^ CRC_INITIAL) >>> 0;
}

/** The most bytes Adler-32 can add before its sums could overflow 32 bits (zlib's NMAX): reduce once per block, not per byte. */
const ADLER_BLOCK = 5552;

function adler32(bytes: Uint8Array): number {
	let low = 1;
	let high = 0;
	for (let start = 0; start < bytes.length; start += ADLER_BLOCK) {
		const end = Math.min(start + ADLER_BLOCK, bytes.length);
		for (let index = start; index < end; index += 1) {
			low += bytes[index] ?? 0;
			high += low;
		}
		low %= ADLER_MODULUS;
		high %= ADLER_MODULUS;
	}
	return ((high << (BITS_PER_BYTE * 2)) | low) >>> 0;
}

/** A 32-bit value, most significant byte first. */
export function uint32BigEndian(value: number): readonly number[] {
	return Array.from({ length: BYTES_PER_UINT32 }, (_byte: undefined, index: number): number => (value >>> (BITS_PER_BYTE * (BYTES_PER_UINT32 - 1 - index))) & BYTE_MASK);
}

/** Image bytes in zlib framing, compressed with the deterministic fixed-Huffman deflate. */
function zlibCompressed(bytes: Uint8Array, rowStride: number): Uint8Array {
	const compressed = deflateFixed(bytes, [BYTES_PER_PIXEL, rowStride]);
	const output = new Uint8Array(ZLIB_HEADER.length + compressed.length + BYTES_PER_UINT32);
	output.set(ZLIB_HEADER, 0);
	output.set(compressed, ZLIB_HEADER.length);
	output.set(uint32BigEndian(adler32(bytes)), ZLIB_HEADER.length + compressed.length);
	return output;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
	const output = new Uint8Array(CHUNK_OVERHEAD + data.length);
	output.set(uint32BigEndian(data.length), 0);
	output.set(TEXT_ENCODER.encode(type), BYTES_PER_UINT32);
	output.set(data, BYTES_PER_UINT32 + CHUNK_TYPE_LENGTH);
	output.set(
		uint32BigEndian(crc32(output.subarray(BYTES_PER_UINT32, BYTES_PER_UINT32 + CHUNK_TYPE_LENGTH + data.length))),
		BYTES_PER_UINT32 + CHUNK_TYPE_LENGTH + data.length,
	);
	return output;
}

function concatenate(parts: readonly Uint8Array[]): Uint8Array {
	const output = new Uint8Array(parts.reduce((total: number, part: Uint8Array): number => total + part.length, 0));
	let cursor = 0;
	for (const part of parts) {
		output.set(part, cursor);
		cursor += part.length;
	}
	return output;
}

/** A PNG of `width` × `height` RGBA pixels (`rgba` holds 4 bytes per pixel, row by row). */
export function encodePng(width: number, height: number, rgba: Uint8Array): Uint8Array {
	const header = Uint8Array.from([
		...uint32BigEndian(width),
		...uint32BigEndian(height),
		BIT_DEPTH,
		COLOR_TYPE_RGBA,
		COMPRESSION_DEFLATE,
		FILTER_METHOD_ADAPTIVE,
		INTERLACE_NONE,
	]);
	const rowLength = width * BYTES_PER_PIXEL;
	const scanlines = new Uint8Array(height * (rowLength + 1));
	for (let row = 0; row < height; row += 1) {
		const start = row * (rowLength + 1);
		scanlines[start] = FILTER_NONE;
		scanlines.set(rgba.subarray(row * rowLength, (row + 1) * rowLength), start + 1);
	}
	return concatenate([Uint8Array.from(PNG_SIGNATURE), chunk("IHDR", header), chunk("IDAT", zlibCompressed(scanlines, rowLength + 1)), chunk("IEND", new Uint8Array(0))]);
}
