import { SIGNUP_REFERRAL_CODE_ALPHABET, SIGNUP_REFERRAL_CODE_LENGTH } from "@workspace/shared";

/** The outcome of normalizing a submitted referral code (ADR 035, "Boundaries"). */
export type NormalizedSignupReferralCode = { readonly kind: "empty" } | { readonly kind: "invalid_shape" } | { readonly kind: "ok"; readonly canonical: string };

/**
 * Trim, then fold case. An omitted value, a JSON `null` and whitespace are
 * empty (no referral). Anything that is not exactly
 * {@link SIGNUP_REFERRAL_CODE_LENGTH} alphabet characters can never match an
 * issued code, so it is rejected before any database read.
 */
export function normalizeSignupReferralCodeInput(raw: string | null | undefined): NormalizedSignupReferralCode {
	const trimmed = (raw ?? "").trim();
	if (trimmed.length === 0) {
		return { kind: "empty" };
	}
	const canonical = trimmed.toUpperCase();
	if (canonical.length !== SIGNUP_REFERRAL_CODE_LENGTH) {
		return { kind: "invalid_shape" };
	}
	for (const character of canonical) {
		if (!SIGNUP_REFERRAL_CODE_ALPHABET.includes(character)) {
			return { kind: "invalid_shape" };
		}
	}
	return { kind: "ok", canonical };
}
