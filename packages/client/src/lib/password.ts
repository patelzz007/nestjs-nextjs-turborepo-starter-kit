// ============================================
// lib/password.ts - Password strength scoring
// ============================================
// Pure, testable helper powering the PasswordStrengthMeter in both apps.
// Deliberately mirrors the same rules as `strongPassword` in the shared
// package (length 8+, upper, lower, digit, special) so the UI's feedback and
// the server's validation never disagree.

export type PasswordScore = 0 | 1 | 2 | 3 | 4;

export interface PasswordStrengthResult {
	/** 0–4 (0 = empty/very weak, 4 = strong). */
	readonly score: PasswordScore;
	/** Human-readable label for the current score. */
	readonly label: string;
	/** Percentage (0–100) for the meter bar width. */
	readonly percent: number;
	/** List of the specific criteria that are still unmet (for checklist UI). */
	readonly missing: readonly string[];
}

const CRITERIA: readonly { readonly key: string; readonly test: (value: string) => boolean; readonly label: string }[] = [
	{ key: "length", test: (value) => value.length >= 8, label: "At least 8 characters" },
	{ key: "upper", test: (value) => /[A-Z]/.test(value), label: "An uppercase letter" },
	{ key: "lower", test: (value) => /[a-z]/.test(value), label: "A lowercase letter" },
	{ key: "digit", test: (value) => /[0-9]/.test(value), label: "A number" },
	{ key: "special", test: (value) => /[^a-zA-Z0-9]/.test(value), label: "A special character" },
];

const LABELS: readonly { readonly minScore: PasswordScore; readonly label: string }[] = [
	{ minScore: 0, label: "Very weak" },
	{ minScore: 1, label: "Weak" },
	{ minScore: 2, label: "Fair" },
	{ minScore: 3, label: "Good" },
	{ minScore: 4, label: "Strong" },
];

function labelForScore(score: PasswordScore): string {
	// Iterate highest-first so the exact score tier wins (score >= minScore).
	for (let index = LABELS.length - 1; index >= 0; index--) {
		const entry = LABELS[index];
		if (entry !== undefined && score >= entry.minScore) {
			return entry.label;
		}
	}
	return LABELS[0]?.label ?? "Very weak";
}

/**
 * Score a password 0–4 based on how many of the five criteria it meets.
 * An empty password scores 0. Passing all five scores 4.
 */
export function passwordStrength(password: string): PasswordStrengthResult {
	const met: number = CRITERIA.filter((c) => c.test(password)).length;

	// Score = number of met criteria (0–4), except an empty password is always 0.
	// Indexed through SCORES so the result is a literal PasswordScore without a
	// type assertion (the repo bans `as` casts).
	const SCORES: readonly PasswordScore[] = [0, 1, 2, 3, 4];
	const score: PasswordScore = password.length === 0 ? 0 : (SCORES[Math.min(met, 4)] ?? 0);
	const missing: readonly string[] = CRITERIA.filter((c) => !c.test(password)).map((c) => c.label);

	return {
		score,
		label: labelForScore(score),
		percent: score * 25,
		missing,
	};
}
