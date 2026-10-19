import { describe, expect, it } from "vitest";

import { UNAMBIGUOUS_CODE_ALPHABET, unambiguousCode } from "../unambiguous-code";

/** Enough draws that every character of the alphabet shows up (32 characters × 2,000 draws). */
const DRAWS = 2_000;
const CODE_LENGTH = 8;
/** One code of {@link CODE_LENGTH} alphabet characters and nothing else. */
const CODE_PATTERN = new RegExp(`^[${UNAMBIGUOUS_CODE_ALPHABET}]{${String(CODE_LENGTH)}}$`, "u");
/** Every character of the alphabet, one per entry. */
const ALPHABET_CHARACTERS: readonly string[] = Array.from({ length: UNAMBIGUOUS_CODE_ALPHABET.length }, (_unused, index) => UNAMBIGUOUS_CODE_ALPHABET.charAt(index));

describe("unambiguousCode", () => {
	it("draws codes of the requested length from the unambiguous alphabet only", () => {
		const codes = Array.from({ length: DRAWS }, () => unambiguousCode(CODE_LENGTH));

		for (const code of codes) {
			expect(code).toMatch(CODE_PATTERN);
		}
		const drawn = codes.join("");
		expect(ALPHABET_CHARACTERS.filter((character) => !drawn.includes(character))).toEqual([]);
	});

	it("never uses look-alike characters", () => {
		expect(UNAMBIGUOUS_CODE_ALPHABET).not.toMatch(/[0O1I]/);
	});

	it("returns an empty code for length zero", () => {
		expect(unambiguousCode(0)).toBe("");
	});
});
