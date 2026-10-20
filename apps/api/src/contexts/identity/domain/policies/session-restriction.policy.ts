import type { EnrollmentReason, EpochMs } from "@workspace/shared";

/** A session is `full`, or `restricted` to finishing an enrollment step (verify email, enroll MFA). */
export type SessionScope = "full" | "restricted";

export type SessionRestriction = { readonly restricted: false } | { readonly restricted: true; readonly reason: EnrollmentReason; readonly message: string };

/** What decides whether a session is restricted. */
export interface SessionRestrictionSubject {
	readonly isEmailVerified: boolean;
	readonly twoFactorEnabled: boolean;
	/** When MFA enrollment becomes mandatory, or `null` (then the configured grace decides). */
	readonly mfaEnrollmentDeadline: EpochMs | null;
	/** The configured enrollment grace; `<= 0` means enrollment is mandatory immediately. */
	readonly enrollmentGraceMs: number;
}

const EMAIL_VERIFICATION_MESSAGE = "Verify your email address to continue.";
const MFA_ENROLLMENT_MESSAGE = "Set up two-factor authentication to continue.";

function requiresMfaEnrollment(subject: SessionRestrictionSubject, now: EpochMs): boolean {
	if (subject.mfaEnrollmentDeadline !== null) {
		return subject.mfaEnrollmentDeadline <= now;
	}
	return subject.enrollmentGraceMs <= 0;
}

/**
 * The authoritative rule for whether a session is `restricted` or `full` — applied at sign-in and on
 * every refresh, so rotating tokens never escalates privileges: an unverified email first, then a
 * due MFA enrollment.
 */
export function resolveSessionRestriction(subject: SessionRestrictionSubject, now: EpochMs): SessionRestriction {
	if (!subject.isEmailVerified) {
		return { restricted: true, reason: "email_verification", message: EMAIL_VERIFICATION_MESSAGE };
	}
	if (!subject.twoFactorEnabled && requiresMfaEnrollment(subject, now)) {
		return { restricted: true, reason: "mfa_enrollment", message: MFA_ENROLLMENT_MESSAGE };
	}
	return { restricted: false };
}

export function sessionScopeOf(restriction: SessionRestriction): SessionScope {
	return restriction.restricted ? "restricted" : "full";
}
