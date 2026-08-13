import { describe, expect, it } from "vitest";

import { passwordStrength } from "./password";

describe("passwordStrength", () => {
	it("scores an empty password 0 with no label bar", () => {
		const result = passwordStrength("");
		expect(result.score).toBe(0);
		expect(result.percent).toBe(0);
		expect(result.label).toBe("Very weak");
		expect(result.missing).toHaveLength(5);
	});

	it("scores a password meeting all five criteria as strong (4)", () => {
		const result = passwordStrength("StrongP@ss1");
		expect(result.score).toBe(4);
		expect(result.percent).toBe(100);
		expect(result.label).toBe("Strong");
		expect(result.missing).toHaveLength(0);
	});

	it("counts each met criterion toward the score", () => {
		// length 8+ + lowercase → 2 points (any 8-char string also matches a char class)
		expect(passwordStrength("aaaaaaaa").score).toBe(2);
		// length + lowercase + uppercase → 3 points
		expect(passwordStrength("Abcdefgh").score).toBe(3);
		// length + lowercase + uppercase + digit → 4 points
		expect(passwordStrength("Abcdefg1").score).toBe(4);
	});

	it("lists the specific unmet criteria as missing", () => {
		const result = passwordStrength("abcdefgh");
		expect(result.missing).toEqual(["An uppercase letter", "A number", "A special character"]);
	});

	it("reports every criterion with its met state for the ✓/✗ checklist", () => {
		const result = passwordStrength("abcdefgh");
		expect(result.criteria).toEqual([
			{ label: "At least 8 characters", met: true },
			{ label: "An uppercase letter", met: false },
			{ label: "A lowercase letter", met: true },
			{ label: "A number", met: false },
			{ label: "A special character", met: false },
		]);

		// A password meeting all five criteria marks every row as met.
		const strong = passwordStrength("StrongP@ss1");
		expect(strong.criteria.every((criterion) => criterion.met)).toBe(true);
	});

	it("caps the score at 4 even for very long passwords", () => {
		// Passes every criterion — still 4, never 5.
		expect(passwordStrength("LongP@ssw0rdWithManyChars").score).toBe(4);
	});
});
