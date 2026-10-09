import { randomInt } from "node:crypto";

import { SIGNUP_REFERRAL_CODE_ALPHABET, SIGNUP_REFERRAL_CODE_LENGTH } from "@workspace/shared";

/** Builds one canonical uppercase signup referral code (ADR 035). */
export function generateSignupReferralCode(): string {
	const alphabet = SIGNUP_REFERRAL_CODE_ALPHABET;
	let code = "";
	for (let index = 0; index < SIGNUP_REFERRAL_CODE_LENGTH; index += 1) {
		const slot = randomInt(alphabet.length);
		code += alphabet[slot] ?? "";
	}
	return code;
}
