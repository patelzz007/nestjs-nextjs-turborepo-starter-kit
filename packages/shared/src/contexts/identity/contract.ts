// API contract leaves owned by the `identity` context (plan §7: the backend owner of each
// endpoint). Composed into `apiContract` (`src/contracts/index.ts`) with identical keys.

import { z } from "zod";

import { EmptyInputSchema, defineContract } from "../../contracts/define-contract";
import { paginatedResponse, singleResponse } from "../../contracts/response";
import { UuidParamSchema } from "../../schemas/domain/platform/param-schemas";
import { authRoutes } from "./routes";
import {
	ConsumerWebSignupSchema,
	ForgotPasswordResponseSchema,
	ForgotPasswordSchema,
	ImpersonateResponseSchema,
	LoginClientResponseSchema,
	LoginSchema,
	LogoutAllResponseSchema,
	LogoutResponseSchema,
	RefreshClientResponseSchema,
	RefreshTokenInputSchema,
	ResendVerificationResponseSchema,
	ResendVerificationSchema,
	ResetPasswordResponseSchema,
	ResetPasswordSchema,
	SignupResponseSchema,
	StopImpersonationResponseSchema,
	VerifyEmailResponseSchema,
	VerifyEmailSchema,
} from "./schemas/auth";
import { ChangePasswordResponseSchema, ChangePasswordSchema } from "./schemas/change-password";
import { RevokeSessionInputSchema, RevokeSessionResponseSchema, SessionListQuerySchema, SessionSchema } from "./schemas/device-session";
import { ValidateResetTokenResponseSchema, ValidateResetTokenSchema, VerifyLoginSchema } from "./schemas/login-verification";
import {
	AdminMfaRecoveryListQuerySchema,
	AdminMfaRecoveryRequestSchema,
	AdminReviewMfaRecoverySchema,
	InitiateMfaRecoverySchema,
	MfaRecoveryStatusResponseSchema,
} from "./schemas/mfa-recovery";
import { OwnProfileSchema, UpdateOwnProfileSchema } from "./schemas/profile";
import { SessionStatusSchema } from "./schemas/session-status";
import {
	BackupCodesRemainingResponseSchema,
	EnableTwoFactorSchema,
	LoginTwoFactorSchema,
	RotateTwoFactorSchema,
	StartTwoFactorSetupSchema,
	TwoFactorMessageResponseSchema,
	TwoFactorSetupResponseSchema,
	VerifyBackupCodeLoginSchema,
	VerifyBackupCodeResponseSchema,
	VerifyBackupCodeSchema,
} from "./schemas/two-factor";
import {
	AdminUserBanResultSchema,
	AdminUserBanSchema,
	AdminUserDetailSchema,
	AdminUserListQuerySchema,
	SessionPermissionsResponseSchema,
	UserResponseSchema,
} from "./schemas/user";

// ── Authentication & user management ───────────────────────────────
// Login, signup, token refresh, password reset, email verification,
// and admin user listing. The admin panel and web app share these.

/** Contract leaves composed into `apiContract.auth`. */
export const authContract = {
	/** "Who am I?" — profile without permissions. */
	me: defineContract({ method: "GET", path: authRoutes.me, input: z.undefined(), response: singleResponse(UserResponseSchema) }),
	/** The signed-in user's own profile (name, avatar, optimistic-lock `version`). */
	profile: defineContract({ method: "GET", path: authRoutes.profile, input: z.undefined(), response: singleResponse(OwnProfileSchema) }),
	/** Edit the signed-in user's own profile — 409 CONFLICT when `version` is stale; refused during impersonation. */
	updateProfile: defineContract({ method: "PATCH", path: authRoutes.profile, input: UpdateOwnProfileSchema, response: singleResponse(OwnProfileSchema) }),
	/** Session roles + permissions (refetch after RBAC mutations). */
	permissions: defineContract({ method: "GET", path: authRoutes.permissions, input: z.undefined(), response: singleResponse(SessionPermissionsResponseSchema) }),
	/** Basic protected endpoint — proves the access token is valid. */
	sessionStatus: defineContract({ method: "GET", path: authRoutes.sessionStatus, input: z.undefined(), response: singleResponse(SessionStatusSchema) }),
	login: defineContract({ access: "public", method: "POST", path: authRoutes.login, input: LoginSchema, response: singleResponse(LoginClientResponseSchema) }),
	/** Admin login — sends `X-Client-Type: admin` for cookie isolation. */
	adminLogin: defineContract({ access: "public", method: "POST", path: authRoutes.adminLogin, input: LoginSchema, response: singleResponse(LoginClientResponseSchema) }),
	signup: defineContract({ access: "public", method: "POST", path: authRoutes.signup, input: ConsumerWebSignupSchema, response: singleResponse(SignupResponseSchema) }),
	/**
	 * Rotate the session tokens. Browser client types send no body (the
	 * refresh token is the httpOnly cookie) and get `{ message }`; client type
	 * `mobile` sends `{ refreshToken }` and gets the rotated tokens in the body
	 * (`RefreshMobileResponseSchema`, ADR 029).
	 */
	refresh: defineContract({
		access: "public",
		method: "POST",
		path: authRoutes.refresh,
		input: RefreshTokenInputSchema,
		response: singleResponse(RefreshClientResponseSchema),
	}),
	/** Sign out this device session — the refresh token comes from the cookie (browsers) or `{ refreshToken }` (`mobile`). Idempotent. */
	logout: defineContract({ access: "public", method: "POST", path: authRoutes.logout, input: RefreshTokenInputSchema, response: singleResponse(LogoutResponseSchema) }),
	/** Sign out every device session of the user, on every client type — the refresh token comes from the cookie (browsers) or `{ refreshToken }` (`mobile`). */
	logoutAll: defineContract({
		access: "public",
		method: "POST",
		path: authRoutes.logoutAll,
		input: RefreshTokenInputSchema,
		response: singleResponse(LogoutAllResponseSchema),
	}),
	/** The caller's device sessions on every client type — the current one first (`isCurrent`), then by last activity. */
	sessions: defineContract({ method: "GET", path: authRoutes.sessions, input: SessionListQuerySchema, response: paginatedResponse(SessionSchema) }),
	/**
	 * Revoke one of the caller's device sessions (404 for any other id). Its
	 * access tokens stop working on the next request (ADR 034); revoking the
	 * caller's own session signs it out. Idempotent.
	 */
	revokeSession: defineContract({
		method: "POST",
		path: authRoutes.revokeSession,
		input: RevokeSessionInputSchema,
		response: singleResponse(RevokeSessionResponseSchema),
	}),
	forgotPassword: defineContract({
		access: "public",
		method: "POST",
		path: authRoutes.forgotPassword,
		input: ForgotPasswordSchema,
		response: singleResponse(ForgotPasswordResponseSchema),
	}),
	resetPassword: defineContract({
		access: "public",
		method: "POST",
		path: authRoutes.resetPassword,
		input: ResetPasswordSchema,
		response: singleResponse(ResetPasswordResponseSchema),
	}),
	validateResetToken: defineContract({
		access: "public",
		method: "POST",
		path: authRoutes.validateResetToken,
		input: ValidateResetTokenSchema,
		response: singleResponse(ValidateResetTokenResponseSchema),
	}),
	resendVerification: defineContract({
		access: "public",
		method: "POST",
		path: authRoutes.resendVerification,
		input: ResendVerificationSchema,
		response: singleResponse(ResendVerificationResponseSchema),
	}),
	verifyEmail: defineContract({
		access: "public",
		method: "POST",
		path: authRoutes.verifyEmail,
		input: VerifyEmailSchema,
		response: singleResponse(VerifyEmailResponseSchema),
	}),
	changePassword: defineContract({
		method: "POST",
		path: authRoutes.changePassword,
		input: ChangePasswordSchema,
		response: singleResponse(ChangePasswordResponseSchema),
	}),
	loginTwoFactor: defineContract({
		access: "public",
		method: "POST",
		path: authRoutes.loginTwoFactor,
		input: LoginTwoFactorSchema,
		response: singleResponse(LoginClientResponseSchema),
	}),
	loginBackupCode: defineContract({
		access: "public",
		method: "POST",
		path: authRoutes.loginBackupCode,
		input: VerifyBackupCodeLoginSchema,
		response: singleResponse(LoginClientResponseSchema),
	}),
	verifyLogin: defineContract({
		access: "public",
		method: "POST",
		path: authRoutes.verifyLogin,
		input: VerifyLoginSchema,
		response: singleResponse(LoginClientResponseSchema),
	}),
	// POST: starting an enrollment stores a new pending secret + backup codes server-side.
	twoFactorSetup: defineContract({
		method: "POST",
		path: authRoutes.twoFactorSetup,
		input: StartTwoFactorSetupSchema,
		response: singleResponse(TwoFactorSetupResponseSchema),
	}),
	twoFactorEnable: defineContract({
		method: "POST",
		path: authRoutes.twoFactorEnable,
		input: EnableTwoFactorSchema,
		response: singleResponse(TwoFactorMessageResponseSchema),
	}),
	twoFactorRotate: defineContract({
		method: "POST",
		path: authRoutes.twoFactorRotate,
		input: RotateTwoFactorSchema,
		response: singleResponse(TwoFactorSetupResponseSchema),
	}),
	twoFactorBackupCodesRemaining: defineContract({
		method: "GET",
		path: authRoutes.twoFactorBackupCodesRemaining,
		input: z.undefined(),
		response: singleResponse(BackupCodesRemainingResponseSchema),
	}),
	twoFactorVerifyBackupCode: defineContract({
		method: "POST",
		path: authRoutes.twoFactorVerifyBackupCode,
		input: VerifyBackupCodeSchema,
		response: singleResponse(VerifyBackupCodeResponseSchema),
	}),
	mfaRecoveryInitiate: defineContract({
		method: "POST",
		path: authRoutes.mfaRecoveryInitiate,
		input: InitiateMfaRecoverySchema,
		response: singleResponse(MfaRecoveryStatusResponseSchema),
	}),
	mfaRecoveryStatus: defineContract({
		method: "GET",
		path: authRoutes.mfaRecoveryStatus,
		input: z.undefined(),
		response: singleResponse(MfaRecoveryStatusResponseSchema),
	}),
	adminMfaRecoveryReview: defineContract({
		method: "POST",
		path: authRoutes.adminMfaRecoveryReview,
		input: AdminReviewMfaRecoverySchema,
		response: singleResponse(MfaRecoveryStatusResponseSchema),
	}),
	adminMfaRecoveryRequests: defineContract({
		method: "GET",
		path: authRoutes.adminMfaRecoveryRequests,
		input: AdminMfaRecoveryListQuerySchema,
		response: paginatedResponse(AdminMfaRecoveryRequestSchema),
	}),
	adminUsers: defineContract({ method: "GET", path: authRoutes.adminUsers, input: AdminUserListQuerySchema, response: paginatedResponse(AdminUserDetailSchema) }),
	adminUserDetail: defineContract({
		method: "GET",
		path: authRoutes.adminUserDetail,
		input: z.object({ userId: UuidParamSchema }).strict(),
		response: singleResponse(AdminUserDetailSchema),
	}),
	adminUserBan: defineContract({
		method: "POST",
		path: authRoutes.adminUserBan,
		input: z.intersection(z.object({ userId: UuidParamSchema }).strict(), AdminUserBanSchema),
		response: singleResponse(AdminUserBanResultSchema),
	}),
	adminUserUnban: defineContract({
		method: "POST",
		path: authRoutes.adminUserUnban,
		input: z.object({ userId: UuidParamSchema }).strict(),
		response: singleResponse(AdminUserBanResultSchema),
	}),
	impersonate: defineContract({
		method: "POST",
		path: authRoutes.impersonate,
		input: z.object({ userId: UuidParamSchema }).strict(),
		response: singleResponse(ImpersonateResponseSchema),
	}),
	stopImpersonation: defineContract({
		method: "POST",
		path: authRoutes.stopImpersonation,
		input: EmptyInputSchema,
		response: singleResponse(StopImpersonationResponseSchema),
	}),
};
