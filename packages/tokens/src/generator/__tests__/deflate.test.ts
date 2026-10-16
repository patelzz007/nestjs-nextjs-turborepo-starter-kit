import { inflateRawSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { deflateFixed } from "./deflate";

describe("deflateFixed", () => {
	it.each([
		["empty input", new Uint8Array(0), [1]],
		["literals only", Uint8Array.from([1, 2, 3, 4, 5, 250, 251, 252]), [1]],
		["a long run", new Uint8Array(1000).fill(7), [1]],
		["repeating pixels", Uint8Array.from({ length: 4000 }, (_value: undefined, index: number): number => [10, 20, 30, 255].at(index % 4) ?? 0), [4, 400]],
		["every byte value", Uint8Array.from({ length: 512 }, (_value: undefined, index: number): number => index % 256), [256]],
	])("round-trips %s through any inflater", (_name, input, distances) => {
		expect([...inflateRawSync(deflateFixed(input, distances))]).toStrictEqual([...input]);
	});

	it("is deterministic", () => {
		const input = new Uint8Array(5000).fill(3);

		expect(deflateFixed(input, [4])).toStrictEqual(deflateFixed(input, [4]));
	});

	it("compresses runs to a few bytes", () => {
		expect(deflateFixed(new Uint8Array(10_000).fill(9), [1]).length).toBeLessThan(100);
	});
});
