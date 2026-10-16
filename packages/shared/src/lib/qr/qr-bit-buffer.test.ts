import { describe, expect, it } from "vitest";

import { QR_CODEWORD_BITS, QrBitBuffer } from "./qr-bit-buffer";

describe("QrBitBuffer", () => {
	it("starts empty", () => {
		const buffer = new QrBitBuffer();
		expect(buffer.length).toBe(0);
		expect(buffer.toCodewords()).toEqual([]);
	});

	it("appends the low bits of a value, most significant first", () => {
		const buffer = new QrBitBuffer();
		buffer.appendBits(0b101, 3);
		buffer.appendBits(0b01, 2);
		expect(buffer.length).toBe(5);
		expect([0, 1, 2, 3, 4].map((index: number): boolean => buffer.bitAt(index))).toEqual([true, false, true, false, true]);
	});

	it("reads past the end as a zero bit", () => {
		const buffer = new QrBitBuffer();
		buffer.appendBits(1, 1);
		expect(buffer.bitAt(1)).toBe(false);
	});

	it("accepts zero bits of zero", () => {
		const buffer = new QrBitBuffer();
		buffer.appendBits(0, 0);
		expect(buffer.length).toBe(0);
	});

	it("rejects a value that does not fit in the bit count, a negative value, or more than 31 bits", () => {
		const buffer = new QrBitBuffer();
		expect(() => {
			buffer.appendBits(4, 2);
		}).toThrow(RangeError);
		expect(() => {
			buffer.appendBits(-1, 4);
		}).toThrow(RangeError);
		expect(() => {
			buffer.appendBits(0, 32);
		}).toThrow(RangeError);
		expect(buffer.length).toBe(0);
	});

	it("packs bits into 8-bit codewords and pads a final partial byte with zeros", () => {
		const buffer = new QrBitBuffer();
		buffer.appendBits(0xab, QR_CODEWORD_BITS);
		buffer.appendBits(0b11, 2);
		expect(buffer.toCodewords()).toEqual([0xab, 0b1100_0000]);
	});
});
