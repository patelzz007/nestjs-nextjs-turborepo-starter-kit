import { applyDecorators, UseGuards } from "@nestjs/common";

import { EmailVerifiedGuard } from "../guards/email-verified.guard";

/**
 * Requires a verified email on the access-token payload (`isEmailVerified`).
 * Global `AuthGuard` already ran; this only adds the verification check.
 */
export const EmailVerified = (): ReturnType<typeof applyDecorators> => {
	return applyDecorators(UseGuards(EmailVerifiedGuard));
};
