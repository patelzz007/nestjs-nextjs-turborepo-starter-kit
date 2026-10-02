import { describe, expect, it } from "vitest";

import { hashLabelToSeed, InvalidRandomRangeError, InvalidRandomSeedError, MAX_RANDOM_SEED, SeededRandom } from "./prng";

function draw(random: SeededRandom, count: number): number[] {
	return Array.from({ length: count }, () => random.next());
}

describe("SeededRandom", () => {
	it("produces the identical sequence for the same seed", () => {
		expect(draw(new SeededRandom(123), 50)).toEqual(draw(new SeededRandom(123), 50));
	});

	it("produces a different sequence for a different seed", () => {
		expect(draw(new SeededRandom(123), 10)).not.toEqual(draw(new SeededRandom(124), 10));
	});

	it("matches the mulberry32 reference output (guards against accidental algorithm changes)", () => {
		const random = new SeededRandom(1);
		const firstThree = draw(random, 3).map((value) => Math.round(value * 0x1_0000_0000));
		expect(firstThree).toEqual([2693262067, 11749833, 2265367787]);
	});

	it("keeps next() within [0, 1)", () => {
		const values = draw(new SeededRandom(7), 10_000);
		expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
		expect(Math.max(...values)).toBeLessThan(1);
	});

	it("accepts the boundary seeds 0 and MAX_RANDOM_SEED", () => {
		expect(() => new SeededRandom(0)).not.toThrow();
		expect(() => new SeededRandom(MAX_RANDOM_SEED)).not.toThrow();
	});

	it.each([-1, 1.5, MAX_RANDOM_SEED + 1, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid seed %s", (seed) => {
		expect(() => new SeededRandom(seed)).toThrow(InvalidRandomSeedError);
	});

	describe("int()", () => {
		it("stays within the inclusive bounds and reaches both ends", () => {
			const random = new SeededRandom(42);
			const values = Array.from({ length: 2_000 }, () => random.int(3, 6));
			expect(new Set(values)).toEqual(new Set([3, 4, 5, 6]));
		});

		it("returns the only value when the bounds are equal", () => {
			expect(new SeededRandom(9).int(5, 5)).toBe(5);
		});

		it("rejects an inverted range", () => {
			expect(() => new SeededRandom(9).int(6, 5)).toThrow(InvalidRandomRangeError);
		});

		it("rejects non-integer bounds", () => {
			expect(() => new SeededRandom(9).int(0.5, 5)).toThrow(InvalidRandomRangeError);
		});
	});

	describe("pick()", () => {
		it("returns an element of the list, deterministically", () => {
			const items = ["a", "b", "c", "d"];
			const first = Array.from({ length: 20 }, (_, index) => new SeededRandom(index).pick(items));
			const second = Array.from({ length: 20 }, (_, index) => new SeededRandom(index).pick(items));
			expect(first).toEqual(second);
			for (const item of first) {
				expect(items).toContain(item);
			}
		});

		it("rejects an empty list", () => {
			expect(() => new SeededRandom(1).pick([])).toThrow(InvalidRandomRangeError);
		});
	});

	describe("chance()", () => {
		it("is always false at 0 and always true at 1", () => {
			const random = new SeededRandom(5);
			expect(Array.from({ length: 100 }, () => random.chance(0)).every((value) => !value)).toBe(true);
			expect(Array.from({ length: 100 }, () => random.chance(1)).every((value) => value)).toBe(true);
		});

		it.each([-0.1, 1.1, Number.NaN])("rejects probability %s", (probability) => {
			expect(() => new SeededRandom(5).chance(probability)).toThrow(InvalidRandomRangeError);
		});
	});

	describe("derive()", () => {
		it("gives the same stream for the same seed and label", () => {
			expect(draw(SeededRandom.derive(10, "members"), 20)).toEqual(draw(SeededRandom.derive(10, "members"), 20));
		});

		it("gives independent streams for different labels", () => {
			expect(draw(SeededRandom.derive(10, "members"), 5)).not.toEqual(draw(SeededRandom.derive(10, "products"), 5));
		});

		it("rejects an invalid base seed", () => {
			expect(() => SeededRandom.derive(-1, "members")).toThrow(InvalidRandomSeedError);
		});
	});
});

describe("hashLabelToSeed", () => {
	it("matches the FNV-1a 32-bit reference values", () => {
		expect(hashLabelToSeed("")).toBe(0x811c9dc5);
		expect(hashLabelToSeed("a")).toBe(0xe40c292c);
		expect(hashLabelToSeed("foobar")).toBe(0xbf9cf968);
	});

	it("always returns a valid unsigned 32-bit seed", () => {
		for (const label of ["x", "enterprise", "1:members", "ünïcödé"]) {
			const seed = hashLabelToSeed(label);
			expect(Number.isInteger(seed)).toBe(true);
			expect(seed).toBeGreaterThanOrEqual(0);
			expect(seed).toBeLessThanOrEqual(MAX_RANDOM_SEED);
		}
	});
});
