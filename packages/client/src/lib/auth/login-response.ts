import { LoginClientResponseSchema, type LoginClientResponse } from "@workspace/shared";

export function isLoginTwoFactorPending(response: LoginClientResponse): response is Extract<LoginClientResponse, { requiresTwoFactor: true }> {
	const parsed = LoginClientResponseSchema.safeParse(response);
	return parsed.success && "requiresTwoFactor" in parsed.data && parsed.data.requiresTwoFactor;
}

export function isLoginVerificationPending(response: LoginClientResponse): response is Extract<LoginClientResponse, { requiresVerification: true }> {
	const parsed = LoginClientResponseSchema.safeParse(response);
	return parsed.success && "requiresVerification" in parsed.data && parsed.data.requiresVerification;
}

export function isLoginSuccess(response: LoginClientResponse): response is Extract<LoginClientResponse, { user: unknown }> {
	const parsed = LoginClientResponseSchema.safeParse(response);
	return parsed.success && "user" in parsed.data;
}
