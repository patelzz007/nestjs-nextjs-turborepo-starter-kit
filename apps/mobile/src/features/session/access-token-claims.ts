// ============================================
// access-token-claims.ts - which kind of session an access token grants
// ============================================
// The root guard needs to know, without a request (and offline), whether the
// stored session is full or restricted to an enrollment step (forced 2FA
// enrollment, email verification). The access token's `sessionScope` claim
// says so. The token is decoded WITHOUT verifying it: this only picks the
// screens to show — the API enforces the scope on every request.

import { JwtPayloadSchema, type EnrollmentReason } from "@workspace/shared";

/** What the stored session lets the app show. */
export type SessionScopeInfo = { readonly scope: "full" } | { readonly scope: "restricted"; readonly enrollmentReason: EnrollmentReason };

export const FULL_SESSION_SCOPE: SessionScopeInfo = { scope: "full" };

/** A JWT: three base64url segments. */
const JWT_PATTERN = /^[\w-]+\.(?<payload>[\w-]+)\.[\w-]*$/;

/** base64url → base64 (padding restored). */
function toBase64(segment: string): string {
	const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
	const padding = (4 - (base64.length % 4)) % 4;
	return base64 + "=".repeat(padding);
}

/**
 * The scope an access token grants, or `null` when the token cannot be read —
 * a corrupt session, which the caller ends (guessing "full" would be unsafe,
 * guessing "restricted" a dead end).
 */
export function readSessionScope(accessToken: string): SessionScopeInfo | null {
	const payloadSegment = JWT_PATTERN.exec(accessToken)?.groups?.payload;
	if (payloadSegment === undefined) {
		return null;
	}
	try {
		const claims = JwtPayloadSchema.safeParse(JSON.parse(atob(toBase64(payloadSegment))));
		if (!claims.success) {
			return null;
		}
		if (claims.data.sessionScope !== "restricted") {
			return FULL_SESSION_SCOPE;
		}
		// Same rule as the web clients: an unverified email is the first restriction to lift.
		return { scope: "restricted", enrollmentReason: claims.data.isEmailVerified === true ? "mfa_enrollment" : "email_verification" };
	} catch {
		return null;
	}
}
