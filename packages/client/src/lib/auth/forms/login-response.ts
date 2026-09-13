import { LoginClientResponseSchema, type LoginClientResponse, type LoginRestrictedEnrollmentClientResponse, type LoginResponse } from "@workspace/shared";

export function isLoginTwoFactorPending(response: LoginClientResponse): response is Extract<LoginClientResponse, { requiresTwoFactor: true }> {
	const parsed = LoginClientResponseSchema.safeParse(response);
	return parsed.success && "requiresTwoFactor" in parsed.data && parsed.data.requiresTwoFactor;
}

export function isLoginVerificationPending(response: LoginClientResponse): response is Extract<LoginClientResponse, { requiresVerification: true }> {
	const parsed = LoginClientResponseSchema.safeParse(response);
	return parsed.success && "requiresVerification" in parsed.data && parsed.data.requiresVerification;
}

export function isLoginRestrictedEnrollment(response: LoginClientResponse): response is LoginRestrictedEnrollmentClientResponse {
	const parsed = LoginClientResponseSchema.safeParse(response);
	return parsed.success && "requiresEnrollment" in parsed.data && parsed.data.requiresEnrollment;
}

export function isLoginSuccess(response: LoginClientResponse): response is LoginResponse {
	const parsed = LoginClientResponseSchema.safeParse(response);
	return (
		parsed.success && "user" in parsed.data && !("requiresEnrollment" in parsed.data) && !("requiresTwoFactor" in parsed.data) && !("requiresVerification" in parsed.data)
	);
}
