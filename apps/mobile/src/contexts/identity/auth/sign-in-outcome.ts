// ============================================
// sign-in-outcome.ts - what a login step answered (§10.1–10.3, §10.5)
// ============================================
// `POST /auth/login`, `/auth/verify-login`, `/auth/login/2fa` and
// `/auth/login/backup-code` all answer `LoginClientResponse`, already validated
// by the api-client. For client type `mobile` (ADR 029) a finished step carries
// the tokens (`tokenTransport: "body"`); an unfinished one names the next step.
// With 2FA on, the order is: password → TOTP or backup code → emailed
// new-device code → tokens (§7.8).

import type { BodyTokenPair } from "@workspace/api-client";
import {
	LoginMobileResponseSchema,
	LoginRestrictedEnrollmentMobileResponseSchema,
	LoginTwoFactorPendingResponseSchema,
	LoginVerificationPendingResponseSchema,
	type LoginClientResponse,
} from "@workspace/shared";

export type SignInOutcome =
	| { readonly kind: "session"; readonly tokens: BodyTokenPair }
	| { readonly kind: "twoFactor"; readonly tempToken: string }
	| { readonly kind: "verifyDevice"; readonly verificationId: string }
	/** A browser-shaped answer without tokens: the API did not treat this request as `mobile`. */
	| { readonly kind: "unexpected" };

/** Picks the variant of a login answer with the shared variant schemas (no hand-written shape checks). */
export function classifySignInResponse(response: LoginClientResponse): SignInOutcome {
	const restricted = LoginRestrictedEnrollmentMobileResponseSchema.safeParse(response);
	if (restricted.success) {
		return { kind: "session", tokens: { accessToken: restricted.data.accessToken, refreshToken: restricted.data.refreshToken } };
	}
	const twoFactor = LoginTwoFactorPendingResponseSchema.safeParse(response);
	if (twoFactor.success) {
		return { kind: "twoFactor", tempToken: twoFactor.data.tempToken };
	}
	const verification = LoginVerificationPendingResponseSchema.safeParse(response);
	if (verification.success) {
		return { kind: "verifyDevice", verificationId: verification.data.verificationId };
	}
	const session = LoginMobileResponseSchema.safeParse(response);
	if (session.success) {
		return { kind: "session", tokens: { accessToken: session.data.accessToken, refreshToken: session.data.refreshToken } };
	}
	return { kind: "unexpected" };
}
