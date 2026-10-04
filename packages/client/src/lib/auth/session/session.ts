import type { EnrollmentReason, SessionPermissionsResponse, UserResponse } from "@workspace/shared";

import type { AuthSessionScope } from "../../features/auth/state";

/**
 * The signed-in user as the client renders it: the `/auth/me` profile fields
 * the UI needs, plus the session's scope from `/auth/permissions`. Composed by
 * the auth facade from those two queries — never stored as a whole.
 */
export interface AuthUser {
	readonly id: string;
	readonly email: string;
	readonly fullName: string;
	readonly isSuperAdmin: boolean;
	readonly hasAdminAccess: boolean;
	readonly isEmailVerified: boolean;
	/**
	 * Mirrors the current access token's `sessionScope` claim; `pending` until
	 * `/auth/permissions` answered for this session. Pending is treated as
	 * restricted ({@link isRestrictedAuthUser}) — the UI fails closed.
	 */
	readonly sessionScope: AuthSessionScope["sessionScope"];
	/** Present when `sessionScope` is `restricted`. */
	readonly enrollmentReason: EnrollmentReason | null;
	readonly roles: readonly { readonly id: string; readonly name: string }[];
}

/** The scope before `/auth/permissions` has answered for the current session. */
export const PENDING_SESSION_SCOPE: AuthSessionScope = { sessionScope: "pending", enrollmentReason: null };

/**
 * The session scope a `/auth/permissions` answer describes, or pending
 * without one. A restricted answer without a reason falls back to what the
 * email-verification flag implies.
 */
export function resolveSessionScope(permissions: SessionPermissionsResponse | undefined, isEmailVerified: boolean): AuthSessionScope {
	if (permissions === undefined) {
		return PENDING_SESSION_SCOPE;
	}
	if (permissions.sessionScope === "restricted") {
		return { sessionScope: "restricted", enrollmentReason: permissions.enrollmentReason ?? resolveEnrollmentReasonFromFlags(isEmailVerified) };
	}
	return { sessionScope: "full", enrollmentReason: null };
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

/**
 * Whether the signed-in user is limited to enrollment routes. A scope that is
 * not known yet counts as restricted (fail closed); the server enforces the
 * real scope on every request regardless.
 */
export function isRestrictedAuthUser(user: AuthUser | null): boolean {
	return user !== null && user.sessionScope !== "full";
}

/** The active enrollment reason of a CONFIRMED restricted session; `null` for a full or still-pending one. */
export function resolveAuthEnrollmentReason(user: AuthUser): EnrollmentReason | null {
	if (user.sessionScope !== "restricted") {
		return null;
	}
	return user.enrollmentReason ?? resolveEnrollmentReasonFromFlags(user.isEmailVerified);
}

function resolveEnrollmentReasonFromFlags(isEmailVerified: boolean): EnrollmentReason {
	return isEmailVerified ? "mfa_enrollment" : "email_verification";
}
