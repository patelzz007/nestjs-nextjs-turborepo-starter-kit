import type { EnrollmentReason, SessionScope, UserResponse } from "@workspace/shared";

import type { AuthSessionScope } from "../../features/auth/state";

/**
 * The signed-in user as the client renders it: the `/auth/me` profile fields
 * the UI needs, plus the session's scope. Composed by the auth facade from the
 * `/auth/me` query and the auth feature store — never stored as a whole.
 */
export interface AuthUser {
	readonly id: string;
	readonly email: string;
	readonly fullName: string;
	readonly isSuperAdmin: boolean;
	readonly hasAdminAccess: boolean;
	readonly isEmailVerified: boolean;
	/** Mirrors the current access token's `sessionScope` claim. */
	readonly sessionScope: SessionScope;
	/** Present when `sessionScope` is `restricted`. */
	readonly enrollmentReason: EnrollmentReason | null;
	readonly roles: readonly { readonly id: string; readonly name: string }[];
}

export interface AuthSessionSource {
	readonly sessionScope?: SessionScope | undefined;
	readonly enrollmentReason?: EnrollmentReason | undefined;
}

/**
 * The session scope a server answer describes. No source (or no scope in it)
 * means a full session; a restricted one without a reason falls back to what
 * the email-verification flag implies.
 */
export function resolveSessionScope(session: AuthSessionSource | null | undefined, isEmailVerified: boolean): AuthSessionScope {
	const sessionScope = session?.sessionScope ?? "full";
	const enrollmentReason = sessionScope === "restricted" ? (session?.enrollmentReason ?? resolveEnrollmentReasonFromFlags(isEmailVerified)) : null;
	return { sessionScope, enrollmentReason };
}

/** The `AuthUser` view of a profile in a given session scope. */
export function composeAuthUser(user: UserResponse, scope: AuthSessionScope): AuthUser {
	return {
		id: user.id,
		email: user.email,
		fullName: user.fullName,
		isSuperAdmin: user.isSuperAdmin,
		hasAdminAccess: user.hasAdminAccess,
		isEmailVerified: user.isEmailVerified,
		sessionScope: scope.sessionScope,
		enrollmentReason: scope.enrollmentReason,
		roles: user.roles,
	};
}

/** Maps an API user record (and the session answer, when known) into the client `AuthUser` shape. */
export function toAuthUser(user: UserResponse, session?: AuthSessionSource | null): AuthUser {
	return composeAuthUser(user, resolveSessionScope(session, user.isEmailVerified));
}

/** Merges JWT-aligned session fields into an existing auth user. */
export function mergeAuthSessionFields(user: AuthUser, session: AuthSessionSource): AuthUser {
	return {
		...user,
		...resolveSessionScope(session, user.isEmailVerified),
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

function resolveEnrollmentReasonFromFlags(isEmailVerified: boolean): EnrollmentReason {
	return isEmailVerified ? "mfa_enrollment" : "email_verification";
}
