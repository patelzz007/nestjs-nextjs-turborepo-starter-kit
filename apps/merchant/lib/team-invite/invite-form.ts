import { ApiError } from "@workspace/client/lib/api/use-api";
import { resolveAuthErrorMessage } from "@workspace/client/lib/auth/errors";
import { LoginVerificationCodeSchema } from "@workspace/shared";

const HTTP_NOT_FOUND = 404;

/** The shared code schema fixes the length; a schema without one is a programming error, caught at load. */
function readCodeLength(): number {
	const length = LoginVerificationCodeSchema.maxLength;
	if (length === null) {
		throw new Error("LoginVerificationCodeSchema must declare the code length");
	}
	return length;
}

/** Digits in the emailed sign-in verification code — read from the shared schema, never repeated as a literal. */
export const VERIFICATION_CODE_LENGTH: number = readCodeLength();
const NON_DIGITS = /\D/g;

/**
 * Cache key of the invitation preview. Scoped to one page instance — never the
 * token itself: invite tokens are credentials and must not land in the query
 * cache or the devtools (the same rule mutation definitions follow).
 */
export const TEAM_INVITE_PREVIEW_QUERY_SCOPE: readonly string[] = ["merchant", "team-invite", "preview"];

export function resolveTeamInviteFormError(error: Error): string {
	if (error instanceof ApiError && error.statusCode === HTTP_NOT_FOUND) {
		return "This invitation could not be found. It may have expired or been withdrawn — ask your organization admin to send a new invite link.";
	}

	return resolveAuthErrorMessage(error);
}

/** Keeps only digits, up to the code length. */
export function sanitizeVerificationCode(value: string): string {
	return value.replace(NON_DIGITS, "").slice(0, VERIFICATION_CODE_LENGTH);
}

export function isCompleteVerificationCode(value: string): boolean {
	return LoginVerificationCodeSchema.safeParse(value).success;
}
