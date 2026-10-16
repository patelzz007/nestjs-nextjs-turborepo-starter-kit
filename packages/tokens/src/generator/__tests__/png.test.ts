import { inflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { encodePng, uint32BigEndian } from "./png";

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const HEADER_OFFSET = 8;
const CHUNK_DATA_OFFSET = 8;

/** The IDAT payload of a single-IDAT PNG. */
function imageData(png: Uint8Array): Uint8Array {
	const bytes = Buffer.from(png);
	const start = bytes.indexOf("IDAT");
	const length = bytes.readUInt32BE(start - 4);
	return bytes.subarray(start + 4, start + 4 + length);
}

describe("encodePng", () => {
	const pixels = Uint8Array.from([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 0, 255, 255, 255, 255]);
	const png = encodePng(2, 2, pixels);

	it("writes the PNG signature and an RGBA header of the right size", () => {
		expect([...png.slice(0, SIGNATURE.length)]).toStrictEqual(SIGNATURE);
		const header = Buffer.from(png).subarray(HEADER_OFFSET + CHUNK_DATA_OFFSET);
		expect(header.readUInt32BE(0)).toBe(2);
		expect(header.readUInt32BE(4)).toBe(2);
		expect(header.readUInt8(9)).toBe(6);
	});

	it("stores pixels any zlib can read back exactly, each row behind a 'none' filter byte", () => {
		expect([...inflateSync(imageData(png))]).toStrictEqual([0, ...pixels.subarray(0, 8), 0, ...pixels.subarray(8)]);
	});

	it("is byte-for-byte deterministic", () => {
		expect(encodePng(2, 2, pixels)).toStrictEqual(png);
	});

	it("compresses flat colour by orders of magnitude, and any zlib reads it back", () => {
		const side = 140;
		const flat = new Uint8Array(side * side * 4).fill(200);
		const encoded = encodePng(side, side, flat);
		const inflated = inflateSync(imageData(encoded));

		expect(inflated.length).toBe(side * (side * 4 + 1));
		expect(encoded.length).toBeLessThan(flat.length / 50);
	});
});

describe("uint32BigEndian", () => {
	it("writes the most significant byte first", () => {
		expect(uint32BigEndian(0x01_02_03_04)).toStrictEqual([1, 2, 3, 4]);
	});
});
