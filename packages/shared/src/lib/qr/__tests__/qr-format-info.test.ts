import { describe, expect, it } from "vitest";

import { QR_FORMAT_INFO_BITS, QR_FORMAT_INFO_MASK, QR_VERSION_INFO_BITS, qrFormatBits, qrVersionBits } from "../qr-format-info";

describe("qrFormatBits", () => {
	it("is the mask pattern itself for M with mask 0 (all-zero data)", () => {
		expect(QR_FORMAT_INFO_MASK).toBe(0x5412);
		expect(qrFormatBits("M", 0)).toBe(0x5412);
	});

	it("matches the 32 format information strings of ISO/IEC 18004 Annex C (Table C.1)", () => {
		expect([0, 1, 2, 3, 4, 5, 6, 7].map((mask: number): number => qrFormatBits("L", mask))).toEqual([0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976]);
		expect([0, 1, 2, 3, 4, 5, 6, 7].map((mask: number): number => qrFormatBits("M", mask))).toEqual([0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0]);
		expect([0, 1, 2, 3, 4, 5, 6, 7].map((mask: number): number => qrFormatBits("Q", mask))).toEqual([0x355f, 0x3068, 0x3f31, 0x3a06, 0x24b4, 0x2183, 0x2eda, 0x2bed]);
		expect([0, 1, 2, 3, 4, 5, 6, 7].map((mask: number): number => qrFormatBits("H", mask))).toEqual([0x1689, 0x13be, 0x1ce7, 0x19d0, 0x0762, 0x0255, 0x0d0c, 0x083b]);
	});

	it("fits in 15 bits", () => {
		expect(QR_FORMAT_INFO_BITS).toBe(15);
		expect(qrFormatBits("L", 0) >>> QR_FORMAT_INFO_BITS).toBe(0);
	});
});

describe("qrVersionBits", () => {
	it("matches the version information strings of ISO/IEC 18004 Annex D (Table D.1)", () => {
		expect(qrVersionBits(7)).toBe(0x07c94);
		expect(qrVersionBits(8)).toBe(0x085bc);
		expect(qrVersionBits(10)).toBe(0x0a4d3);
		expect(qrVersionBits(21)).toBe(0x15683);
		expect(qrVersionBits(40)).toBe(0x28c69);
	});

	it("keeps the version in the top 6 of 18 bits", () => {
		expect(QR_VERSION_INFO_BITS).toBe(18);
		expect(qrVersionBits(33) >>> 12).toBe(33);
	});
});
