import { describe, expect, it } from "vitest";

import { normalizeSignupReferralCodeInput } from "./signup-referral-code.normalizer";

describe("normalizeSignupReferralCodeInput", () => {
	it("treats omitted, null, empty and whitespace as no code", () => {
		expect(normalizeSignupReferralCodeInput(undefined)).toEqual({ kind: "empty" });
		expect(normalizeSignupReferralCodeInput(null)).toEqual({ kind: "empty" });
		expect(normalizeSignupReferralCodeInput("")).toEqual({ kind: "empty" });
		expect(normalizeSignupReferralCodeInput("   ")).toEqual({ kind: "empty" });
	});

	it("trims and folds case to the canonical uppercase code", () => {
		expect(normalizeSignupReferralCodeInput(" ab23cd45 ")).toEqual({ kind: "ok", canonical: "AB23CD45" });
	});

	it("rejects a value of the wrong length", () => {
		expect(normalizeSignupReferralCodeInput("AB23CD456")).toEqual({ kind: "invalid_shape" });
		expect(normalizeSignupReferralCodeInput("AB23CD4")).toEqual({ kind: "invalid_shape" });
	});

	it("rejects characters outside the issued alphabet, including look-alikes and internal spaces", () => {
		expect(normalizeSignupReferralCodeInput("AB23OD45")).toEqual({ kind: "invalid_shape" });
		expect(normalizeSignupReferralCodeInput("AB2 CD45")).toEqual({ kind: "invalid_shape" });
	});

	it("rejects a character whose uppercase form changes the length", () => {
		expect(normalizeSignupReferralCodeInput("AB23CD4ß")).toEqual({ kind: "invalid_shape" });
	});
});
