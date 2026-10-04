import { describe, expect, it } from "vitest";

import { sha256Hex } from "./sha256";

/** FIPS 180-2 / NIST test vectors. */
const EMPTY_DIGEST = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const ABC_DIGEST = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
/** Two-byte UTF-8 input — proves the string is hashed as UTF-8, not Latin-1. */
const UTF8_INPUT = "é";
const UTF8_DIGEST = "4a99557e4033c3539de2eb65472017cad5f9557f7a0625a09f1c3f6e2ba69c4c";

describe("sha256Hex", () => {
	it("matches the published SHA-256 test vectors as lowercase hex", () => {
		expect(sha256Hex("")).toBe(EMPTY_DIGEST);
		expect(sha256Hex("abc")).toBe(ABC_DIGEST);
	});

	it("is deterministic and 64 hex characters long", () => {
		expect(sha256Hex("token")).toBe(sha256Hex("token"));
		expect(sha256Hex("token")).toMatch(/^[0-9a-f]{64}$/);
		expect(sha256Hex("token")).not.toBe(sha256Hex("Token"));
	});

	it("hashes the UTF-8 encoding of the input", () => {
		expect(sha256Hex(UTF8_INPUT)).toBe(UTF8_DIGEST);
	});
});
