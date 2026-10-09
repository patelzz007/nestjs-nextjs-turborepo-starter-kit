// Input shaping for the six-digit codes (TOTP and the emailed new-device code).
// Validation stays with the shared schemas (TotpCodeSchema, LoginVerificationCodeSchema).

import { TOTP_CODE_LENGTH } from "@workspace/shared";

const NON_DIGIT_PATTERN = /\D/g;

/** Keeps only digits, at most one six-digit code long (pasted "123 456" becomes "123456"). */
export function sanitizeCodeInput(value: string): string {
	return value.replace(NON_DIGIT_PATTERN, "").slice(0, TOTP_CODE_LENGTH);
}
