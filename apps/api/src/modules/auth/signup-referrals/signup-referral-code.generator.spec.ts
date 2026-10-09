import { SIGNUP_REFERRAL_CODE_ALPHABET, SIGNUP_REFERRAL_CODE_LENGTH } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { generateSignupReferralCode } from "./signup-referral-code.generator";

/** Enough samples that a generator leaking an excluded character would show it. */
const SAMPLE_COUNT = 200;

/** Exactly one issued code: the length, from the alphabet only. */
const ISSUED_CODE_PATTERN = new RegExp(`^[${SIGNUP_REFERRAL_CODE_ALPHABET}]{${String(SIGNUP_REFERRAL_CODE_LENGTH)}}$`, "u");

describe("generateSignupReferralCode", () => {
	it("builds codes of the issued length from the look-alike-free alphabet only", () => {
		for (let sample = 0; sample < SAMPLE_COUNT; sample += 1) {
			expect(generateSignupReferralCode()).toMatch(ISSUED_CODE_PATTERN);
		}
	});

	it("never emits 0, O, 1, I or L", () => {
		const codes = Array.from({ length: SAMPLE_COUNT }, () => generateSignupReferralCode()).join("");

		expect(codes).not.toMatch(/[01OIL]/);
	});
});
