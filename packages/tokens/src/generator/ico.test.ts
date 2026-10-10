import { describe, expect, it } from "vitest";

import { encodeIco } from "./ico";

describe("encodeIco", () => {
	const small = Uint8Array.from([1, 2, 3]);
	const large = Uint8Array.from([4, 5, 6, 7]);
	const ico = Buffer.from(
		encodeIco([
			{ size: 16, png: small },
			{ size: 256, png: large },
		]),
	);

	it("starts with an icon header that counts its images", () => {
		expect(ico.readUInt16LE(0)).toBe(0);
		expect(ico.readUInt16LE(2)).toBe(1);
		expect(ico.readUInt16LE(4)).toBe(2);
	});

	it("describes each image — size (256 written as 0), 32-bit colour, length and offset", () => {
		expect(ico.readUInt8(6)).toBe(16);
		expect(ico.readUInt16LE(6 + 6)).toBe(32);
		expect(ico.readUInt32LE(6 + 8)).toBe(small.length);
		expect(ico.readUInt32LE(6 + 12)).toBe(6 + 16 * 2);
		expect(ico.readUInt8(22)).toBe(0);
		expect(ico.readUInt32LE(22 + 12)).toBe(6 + 16 * 2 + small.length);
	});

	it("appends the images back to back", () => {
		expect([...ico.subarray(6 + 16 * 2)]).toStrictEqual([...small, ...large]);
	});
});
