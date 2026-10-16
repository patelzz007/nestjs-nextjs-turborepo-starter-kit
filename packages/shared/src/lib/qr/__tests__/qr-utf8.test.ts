import { describe, expect, it } from "vitest";

import { encodeUtf8, encodeUtf8CodePoint } from "../qr-utf8";

describe("encodeUtf8CodePoint", () => {
	it("encodes each sequence length at its boundaries", () => {
		expect(encodeUtf8CodePoint(0x41)).toEqual([0x41]);
		expect(encodeUtf8CodePoint(0x7f)).toEqual([0x7f]);
		expect(encodeUtf8CodePoint(0x80)).toEqual([0xc2, 0x80]);
		expect(encodeUtf8CodePoint(0x7ff)).toEqual([0xdf, 0xbf]);
		expect(encodeUtf8CodePoint(0x800)).toEqual([0xe0, 0xa0, 0x80]);
		expect(encodeUtf8CodePoint(0xffff)).toEqual([0xef, 0xbf, 0xbf]);
		expect(encodeUtf8CodePoint(0x10000)).toEqual([0xf0, 0x90, 0x80, 0x80]);
		expect(encodeUtf8CodePoint(0x10ffff)).toEqual([0xf4, 0x8f, 0xbf, 0xbf]);
	});
});

describe("encodeUtf8", () => {
	it("encodes ASCII, Latin, CJK and emoji (surrogate pairs) like the platform TextEncoder", () => {
		const encoder = new TextEncoder();
		for (const text of ["", "HELLO", "Café", "東京", "Привет", "🎁", "a🎁b☕c", "otpauth://totp/A:b%40c?secret=JBSWY3DP"]) {
			expect(encodeUtf8(text)).toEqual(Array.from(encoder.encode(text)));
		}
	});

	it("encodes known byte sequences", () => {
		expect(encodeUtf8("é")).toEqual([0xc3, 0xa9]);
		expect(encodeUtf8("€")).toEqual([0xe2, 0x82, 0xac]);
		expect(encodeUtf8("🎁")).toEqual([0xf0, 0x9f, 0x8e, 0x81]);
	});

	it("replaces a lone surrogate with U+FFFD, as TextEncoder does", () => {
		const loneHigh = String.fromCharCode(0xd83c);
		const loneLow = String.fromCharCode(0xdf81);
		expect(encodeUtf8(`a${loneHigh}b`)).toEqual([0x61, 0xef, 0xbf, 0xbd, 0x62]);
		expect(encodeUtf8(loneLow)).toEqual([0xef, 0xbf, 0xbd]);
		expect(encodeUtf8(`x${loneHigh}`)).toEqual(Array.from(new TextEncoder().encode(`x${loneHigh}`)));
	});
});
