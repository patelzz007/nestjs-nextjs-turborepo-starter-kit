import { z } from "zod";
import { canonicalEmailSchema } from "../api/email-address";
import { EnrollmentReasonSchema, SessionScopeSchema } from "./enrollment";
import { LoginVerificationPendingResponseSchema } from "./login-verification";
import { LoginTwoFactorPendingResponseSchema } from "./two-factor";
import { EpochMsSchema } from "../api/common";
import { OrganizationSlugSchema } from "../domain/organization/organization";
import { VerifyEmailTokenParamSchema } from "../domain/platform/param-schemas";
import { strongPassword } from "./password";
import { UserResponseSchema } from "./user";
import { PlainMessageResponseSchema } from "../api/message";

export { strongPassword } from "./password";

// ── Input Schemas ────────────────────────────────────────────────────────

export const LoginSchema = z
	.object({
		email: canonicalEmailSchema("Invalid email address").meta({
			description: "User email address",
			example: "admin@example.com",
		}),
		password: z.string().min(1, "Password is required").meta({
			description: "User password",
			example: "Admin@123",
		}),
	})
	.strict();

export type LoginInput = z.output<typeof LoginSchema>;

export const SignupSchema = z
	.object({
		email: canonicalEmailSchema("Invalid email address"),
		password: strongPassword.meta({
			description: "User password (must meet complexity requirements)",
			example: "StrongP@ss1",
		}),
		fullName: z.string().min(2, "Full name must be at least 2 characters").meta({
			description: "User's full name",
			example: "Jane Doe",
		}),
	})
	.strict();

export type SignupInput = z.output<typeof SignupSchema>;

export const ForgotPasswordSchema = z
	.object({
		email: canonicalEmailSchema("Invalid email address").meta({
			description: "The email address associated with the user account",
			example: "user@example.com",
		}),
	})
	.strict();

export type ForgotPasswordInput = z.output<typeof ForgotPasswordSchema>;

/** Which frontend initiated an auth action (matches `X-Client-Type`). */
export const AuthClientTypeSchema = z.enum(["web", "admin", "merchant"]);

export type AuthClientType = z.output<typeof AuthClientTypeSchema>;

/**
 * `?client_type=` on the public auth endpoints — the fallback for callers that
 * cannot set the `X-Client-Type` header (e.g. Swagger UI's "Try it out").
 * Not strict: other query keys are ignored, exactly as before.
 */
export const AuthClientTypeQuerySchema = z.object({
	client_type: AuthClientTypeSchema.optional().describe("Which frontend initiated the action (fallback for the X-Client-Type header)."),
});

export type AuthClientTypeQuery = z.output<typeof AuthClientTypeQuerySchema>;

export const ResetPasswordSchema = z
	.object({
		token: z.string().min(1, "Reset token is required").meta({
			description: "The password reset token received via email",
			example: "eyJhbGciOiJIUzI1NiIs...",
		}),
		password: strongPassword.meta({
			description: "New password (min 8 chars, upper+lower+number+special)",
			example: "NewSecure@456",
		}),
	})
	.strict();

export type ResetPasswordInput = z.output<typeof ResetPasswordSchema>;

export const ResendVerificationSchema = z
	.object({
		email: canonicalEmailSchema("Invalid email address").meta({
			description: "The email address to resend verification to",
			example: "user@example.com",
		}),
	})
	.strict();

export type ResendVerificationInput = z.output<typeof ResendVerificationSchema>;

// ── Session ──────────────────────────────────────────────────────────────

export const SessionSchema = z.object({
	id: z.string(),
	deviceInfo: z.string().nullable(),
	ipAddress: z.string().nullable(),
	expiresAt: EpochMsSchema,
	createdAt: EpochMsSchema,
});

export type Session = z.output<typeof SessionSchema>;

/** `GET /auth/sessions` — the caller's active sessions. */
export const SessionListResponseSchema = z.array(SessionSchema);

export type SessionListResponse = z.output<typeof SessionListResponseSchema>;

// ── Service-level schemas (not exposed to FE clients) ────────────────────

/**
 * Login response returned by AuthService.login().
 * Includes tokens so the controller can set them as httpOnly cookies
 * before stripping them from the JSON response body.
 */
export const LoginServiceResponseSchema = z
	.object({
		user: UserResponseSchema,
		accessToken: z.string(),
		refreshToken: z.string(),
	})
	.strict();

export type LoginServiceResponse = z.output<typeof LoginServiceResponseSchema>;

export { EnrollmentReasonSchema, SessionScopeSchema };
export type { EnrollmentReason, SessionScope } from "./enrollment";

/**
 * Login response when the user receives a restricted enrollment session
 * (tokens are set as httpOnly cookies; stripped from the JSON body).
 */
export const LoginRestrictedEnrollmentResponseSchema = z
	.object({
		requiresEnrollment: z.literal(true),
		enrollmentReason: EnrollmentReasonSchema,
		message: z.string(),
		user: UserResponseSchema.optional(),
		/** Present for merchant portal logins so the client can route to org-scoped settings. */
		organizationSlug: OrganizationSlugSchema.optional(),
		accessToken: z.string(),
		refreshToken: z.string(),
	})
	.strict();

export type LoginRestrictedEnrollmentResponse = z.output<typeof LoginRestrictedEnrollmentResponseSchema>;

/** Client-visible restricted enrollment result after cookies are set. */
export const LoginRestrictedEnrollmentClientResponseSchema = z.object({
	requiresEnrollment: z.literal(true),
	enrollmentReason: EnrollmentReasonSchema,
	message: z.string(),
	user: UserResponseSchema.optional(),
	/** Present for merchant portal logins so the client can route to org-scoped settings. */
	organizationSlug: OrganizationSlugSchema.optional(),
});

export type LoginRestrictedEnrollmentClientResponse = z.output<typeof LoginRestrictedEnrollmentClientResponseSchema>;

/**
 * Token refresh response returned by AuthService.refreshToken().
 * The controller sets both tokens as httpOnly cookies.
 */
export const RefreshResponseSchema = z
	.object({
		accessToken: z.string(),
		refreshToken: z.string(),
	})
	.strict();

export type RefreshResponse = z.output<typeof RefreshResponseSchema>;

// ── Response Schemas ─────────────────────────────────────────────────────

export const LoginResponseSchema = z.object({
	user: UserResponseSchema,
});

export type LoginResponse = z.output<typeof LoginResponseSchema>;

/**
 * Client-visible login result after cookies are set (or 2FA / verification step required).
 *
 * The response contract of every login-like route (`/auth/login`, `/auth/verify-login`,
 * `/auth/login/2fa`, `/auth/login/backup-code`): `SetAuthCookiesInterceptor` moves the
 * tokens into httpOnly cookies, and parsing with this schema strips any token that
 * would still be in the body.
 *
 * ORDER MATTERS. The variants share no common discriminator key, and response
 * objects strip unknown keys, so `z.union` returns the FIRST option that
 * matches and silently drops the fields of later ones. Every flag-carrying
 * variant (`requiresEnrollment` / `requiresTwoFactor` / `requiresVerification`,
 * each a required `true` literal) therefore comes BEFORE the plain `{ user }`
 * success: the restricted-enrollment variant carries an optional `user` and
 * would otherwise be swallowed by `LoginResponseSchema`. No flag variant can
 * match another's payload (each requires its own literal flag).
 */
export const LoginClientResponseSchema = z.union([
	LoginRestrictedEnrollmentClientResponseSchema,
	LoginTwoFactorPendingResponseSchema,
	LoginVerificationPendingResponseSchema,
	LoginResponseSchema,
]);

export type LoginClientResponse = z.output<typeof LoginClientResponseSchema>;

export const SignupResponseSchema = PlainMessageResponseSchema;

export type SignupResponse = z.output<typeof SignupResponseSchema>;

export const RefreshResponseMessageSchema = PlainMessageResponseSchema;

export type RefreshResponseMessage = z.output<typeof RefreshResponseMessageSchema>;

export const LogoutResponseSchema = PlainMessageResponseSchema;

export type LogoutResponse = z.output<typeof LogoutResponseSchema>;

export const LogoutAllResponseSchema = PlainMessageResponseSchema;

export type LogoutAllResponse = z.output<typeof LogoutAllResponseSchema>;

export const ForgotPasswordResponseSchema = PlainMessageResponseSchema;

export type ForgotPasswordResponse = z.output<typeof ForgotPasswordResponseSchema>;

export const ResetPasswordResponseSchema = PlainMessageResponseSchema;

export type ResetPasswordResponse = z.output<typeof ResetPasswordResponseSchema>;

export const ResendVerificationResponseSchema = PlainMessageResponseSchema;

export type ResendVerificationResponse = z.output<typeof ResendVerificationResponseSchema>;

export const VerifyEmailSchema = z
	.object({
		token: VerifyEmailTokenParamSchema,
	})
	.strict();

export type VerifyEmailInput = z.output<typeof VerifyEmailSchema>;

export const VerifyEmailResponseSchema = z.object({
	message: z.string(),
	/**
	 * True when the address was already verified before this request (a
	 * second click on the link, or a concurrent request won). Clients branch
	 * on this flag — never on the human-readable `message`.
	 */
	alreadyVerified: z.boolean(),
});

export type VerifyEmailResponse = z.output<typeof VerifyEmailResponseSchema>;

export const ImpersonateResponseSchema = z.object({
	message: z.string(),
	impersonating: z.literal(true),
	originalUserId: z.string(),
	user: UserResponseSchema,
});

export type ImpersonateResponse = z.output<typeof ImpersonateResponseSchema>;

/** Service/controller payload before `SetAuthCookiesInterceptor` strips tokens. */
export const ImpersonateServiceResponseSchema = ImpersonateResponseSchema.extend({
	accessToken: z.string(),
}).strict();

export type ImpersonateServiceResponse = z.output<typeof ImpersonateServiceResponseSchema>;

export const StopImpersonationResponseSchema = PlainMessageResponseSchema;

export type StopImpersonationResponse = z.output<typeof StopImpersonationResponseSchema>;

/** Service/controller payload before `SetAuthCookiesInterceptor` strips tokens. */
export const StopImpersonationServiceResponseSchema = StopImpersonationResponseSchema.extend({
	accessToken: z.string(),
}).strict();

export type StopImpersonationServiceResponse = z.output<typeof StopImpersonationServiceResponseSchema>;

// ── JWT payload (decoded, unverified) ─────────────────────────────────

/**
 * Minimal JWT payload shape the client needs for route-protection decisions.
 * Only the fields the proxy and auth context actually read — the full token
 * carries more claims, but this is all the frontend needs.
 */
export const JwtPayloadSchema = z
	.object({
		sub: z.string().optional(),
		email: z.string().optional(),
		exp: z.number().int().optional(),
		hasAdminAccess: z.boolean().optional(),
		isSuperAdmin: z.boolean().optional(),
		isEmailVerified: z.boolean().optional(),
		sessionScope: SessionScopeSchema.optional(),
	})
	.loose();

export type JwtPayload = z.output<typeof JwtPayloadSchema>;

// Re-exports for backward compatibility

export { SlimRoleSchema, PermissionDetailsSchema, UserResponseSchema } from "./user";
export type { SlimRoleResponse, PermissionDetailsResponse, UserResponse } from "./user";
