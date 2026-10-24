// API path templates owned by the `identity` context. Composed into `apiRoutes`
// (`src/api-routes.ts`) with identical keys and values.

import type { RouteTree } from "../../route-tree";

// ── Auth ────────────────────────────────────────────────────────────

/** Path templates composed into `apiRoutes.auth`. */
export const authRoutes = {
	me: "/auth/me",
	/** The signed-in user's own profile — GET reads it, PATCH edits it. */
	profile: "/auth/profile",
	/** The signed-in user's remembered choices — GET lists them; PUT and DELETE on `/:key` set one or reset it to the default. */
	preferences: "/auth/preferences",
	preference: "/auth/preferences/:key",
	permissions: "/auth/permissions",
	sessionStatus: "/session",
	login: "/auth/login",
	adminLogin: "/auth/login",
	signup: "/auth/signup",
	refresh: "/auth/refresh",
	logout: "/auth/logout",
	logoutAll: "/auth/logout-all",
	/** The caller's device sessions. */
	sessions: "/auth/sessions",
	/** Revoke one of the caller's device sessions (ADR 034). */
	revokeSession: "/auth/sessions/:sessionId/revoke",
	forgotPassword: "/auth/forgot-password",
	resetPassword: "/auth/reset-password",
	resendVerification: "/auth/resend-verification",
	verifyEmail: "/auth/verify-email",
	adminUsers: "/auth/admin/users",
	adminUserDetail: "/auth/admin/users/:userId",
	/** A platform admin bans an account (it can no longer sign in; every session is revoked). */
	adminUserBan: "/auth/admin/users/:userId/ban",
	adminUserUnban: "/auth/admin/users/:userId/unban",
	impersonate: "/auth/impersonate/:userId",
	stopImpersonation: "/auth/stop-impersonation",
	changePassword: "/auth/change-password",
	loginTwoFactor: "/auth/login/2fa",
	loginBackupCode: "/auth/login/backup-code",
	verifyLogin: "/auth/verify-login",
	validateResetToken: "/auth/validate-reset-token",
	twoFactorSetup: "/auth/2fa/setup",
	twoFactorEnable: "/auth/2fa/enable",
	twoFactorRotate: "/auth/2fa/rotate",
	twoFactorBackupCodesRemaining: "/auth/2fa/backup-codes/remaining",
	twoFactorVerifyBackupCode: "/auth/2fa/verify-backup-code",
	mfaRecoveryInitiate: "/auth/mfa/recovery",
	mfaRecoveryStatus: "/auth/mfa/recovery/status",
	adminMfaRecoveryReview: "/auth/admin/mfa/recovery/review",
	adminMfaRecoveryRequests: "/auth/admin/mfa/recovery/requests",
} satisfies Record<string, RouteTree>;
