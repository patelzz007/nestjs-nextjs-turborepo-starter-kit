import { describe, expect, it } from "vitest";

import { type QrBitBuffer } from "./qr-bit-buffer";
import {
	characterCountBits,
	makeAlphanumericSegment,
	makeByteSegment,
	makeNumericSegment,
	makeSegment,
	QR_ALPHANUMERIC_CHARSET,
	QR_MODE_INDICATOR,
	segmentsBitLength,
	selectQrMode,
} from "./qr-segment";

/** A buffer's bits as a `0`/`1` string. */
function bitString(buffer: QrBitBuffer): string {
	return Array.from({ length: buffer.length }, (_: undefined, index: number): string => (buffer.bitAt(index) ? "1" : "0")).join("");
}

describe("selectQrMode", () => {
	it("picks numeric for digits only (and for the empty string)", () => {
		expect(selectQrMode("0123456789")).toBe("numeric");
		expect(selectQrMode("")).toBe("numeric");
	});

	it("picks alphanumeric for upper-case letters, digits, space and $%*+-./:", () => {
		expect(selectQrMode("HELLO WORLD")).toBe("alphanumeric");
		expect(selectQrMode(QR_ALPHANUMERIC_CHARSET)).toBe("alphanumeric");
	});

	it("falls back to byte mode for lower case, other punctuation and non-ASCII", () => {
		expect(selectQrMode("Hello")).toBe("byte");
		expect(selectQrMode("A?B")).toBe("byte");
		expect(selectQrMode("CAFÉ")).toBe("byte");
		expect(selectQrMode("pos-pair:v1:ABCD2345")).toBe("byte");
	});
});

describe("characterCountBits", () => {
	it("follows the three version bands of ISO/IEC 18004 Table 3", () => {
		expect([1, 9, 10, 26, 27, 40].map((version: number): number => characterCountBits("numeric", version))).toEqual([10, 10, 12, 12, 14, 14]);
		expect([1, 9, 10, 26, 27, 40].map((version: number): number => characterCountBits("alphanumeric", version))).toEqual([9, 9, 11, 11, 13, 13]);
		expect([1, 9, 10, 26, 27, 40].map((version: number): number => characterCountBits("byte", version))).toEqual([8, 8, 16, 16, 16, 16]);
	});
});

describe("makeNumericSegment", () => {
	it("packs groups of three digits into 10 bits and a trailing pair into 7 (the standard's 01234567 example)", () => {
		const segment = makeNumericSegment("01234567");
		expect(segment.mode).toBe("numeric");
		expect(segment.characterCount).toBe(8);
		expect(bitString(segment.data)).toBe("0000001100" + "0101011001" + "1000011");
	});

	it("packs a trailing single digit into 4 bits", () => {
		expect(bitString(makeNumericSegment("1234").data)).toBe("0001111011" + "0100");
	});

	it("rejects non-digits", () => {
		expect(() => makeNumericSegment("12a")).toThrow(RangeError);
	});
});

describe("makeAlphanumericSegment", () => {
	it("packs pairs into 11 bits and a trailing single into 6 (the standard's AC-42 example)", () => {
		const segment = makeAlphanumericSegment("AC-42");
		expect(segment.characterCount).toBe(5);
		expect(bitString(segment.data)).toBe("00111001110" + "11100111001" + "000010");
	});

	it("rejects characters outside the alphanumeric set", () => {
		expect(() => makeAlphanumericSegment("ab")).toThrow(RangeError);
	});
});

describe("makeByteSegment", () => {
	it("writes UTF-8 bytes and counts bytes, not characters", () => {
		const segment = makeByteSegment("é!");
		expect(segment.characterCount).toBe(3);
		expect(bitString(segment.data)).toBe("11000011" + "10101001" + "00100001");
	});
});

describe("makeSegment", () => {
	it("dispatches to the mode selectQrMode picks", () => {
		expect(makeSegment("123").mode).toBe("numeric");
		expect(makeSegment("ABC").mode).toBe("alphanumeric");
		expect(makeSegment("abc").mode).toBe("byte");
	});
});

describe("QR_MODE_INDICATOR", () => {
	it("holds the 4-bit indicators of Table 2", () => {
		expect(QR_MODE_INDICATOR).toEqual({ numeric: 0b0001, alphanumeric: 0b0010, byte: 0b0100 });
	});
});

describe("segmentsBitLength", () => {
	it("adds the mode indicator, the count field for the version and the data bits", () => {
		const segment = makeAlphanumericSegment("HELLO WORLD");
		expect(segmentsBitLength([segment], 1)).toBe(4 + 9 + 61);
		expect(segmentsBitLength([segment], 10)).toBe(4 + 11 + 61);
	});

	it("is zero for no segments", () => {
		expect(segmentsBitLength([], 1)).toBe(0);
	});

	it("is undefined when the character count overflows the version's count field", () => {
		const segment = makeByteSegment("a".repeat(256));
		expect(segmentsBitLength([segment], 9)).toBeUndefined();
		expect(segmentsBitLength([segment], 10)).toBe(4 + 16 + 256 * 8);
	});
});
