import type { EnrollmentReason, SessionScope, UserResponse } from "@workspace/shared";

import type { AuthUser } from "./store";

export interface AuthSessionSource {
	readonly sessionScope?: SessionScope;
	readonly enrollmentReason?: EnrollmentReason;
}

/** Maps an API user record into the client auth-store shape. */
export function toAuthUser(user: UserResponse, session?: AuthSessionSource | null): AuthUser {
	const sessionScope = session?.sessionScope ?? "full";
	const enrollmentReason = sessionScope === "restricted" ? (session?.enrollmentReason ?? resolveEnrollmentReasonFromUser(user)) : null;

	return {
		id: user.id,
		email: user.email,
		fullName: user.fullName,
		isSuperAdmin: user.isSuperAdmin,
		hasAdminAccess: user.hasAdminAccess,
		isEmailVerified: user.isEmailVerified,
		sessionScope,
		enrollmentReason,
		roles: user.roles,
	};
}

/** Merges JWT-aligned session fields into an existing auth user. */
export function mergeAuthSessionFields(user: AuthUser, session: AuthSessionSource): AuthUser {
	const sessionScope = session.sessionScope ?? "full";
	const enrollmentReason = sessionScope === "restricted" ? (session.enrollmentReason ?? resolveEnrollmentReasonFromFlags(user.isEmailVerified)) : null;

	return {
		...user,
		sessionScope,
		enrollmentReason,
	};
}

/** Whether the signed-in user is limited to enrollment routes. */
export function isRestrictedAuthUser(user: AuthUser | null): boolean {
	return user?.sessionScope === "restricted";
}

/** Resolves the active enrollment reason for a restricted session. */
export function resolveAuthEnrollmentReason(user: AuthUser): EnrollmentReason | null {
	if (user.sessionScope !== "restricted") {
		return null;
	}

	return user.enrollmentReason ?? resolveEnrollmentReasonFromFlags(user.isEmailVerified);
}

function resolveEnrollmentReasonFromUser(user: UserResponse): EnrollmentReason {
	return resolveEnrollmentReasonFromFlags(user.isEmailVerified);
}

function resolveEnrollmentReasonFromFlags(isEmailVerified: boolean): EnrollmentReason {
	return isEmailVerified ? "mfa_enrollment" : "email_verification";
}
