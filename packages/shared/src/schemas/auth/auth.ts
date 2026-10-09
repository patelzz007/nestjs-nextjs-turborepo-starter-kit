import { z } from "zod";
import { canonicalEmailSchema } from "../api/email-address";
import { EnrollmentReasonSchema, SessionScopeSchema } from "./enrollment";
import { LoginVerificationPendingResponseSchema } from "./login-verification";
import { LoginTwoFactorPendingResponseSchema } from "./two-factor";
import { OrganizationSlugSchema } from "../domain/organization/organization";
import { VerifyEmailTokenParamSchema } from "../domain/platform/param-schemas";
import { strongPassword } from "./password";
import { UserResponseSchema } from "./user";
import { PlainMessageResponseSchema } from "../api/message";
import { SignupReferralCodeInputSchema } from "../domain/signup-referrals/signup-referrals";

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

/**
 * Consumer web signup (ADR 035): {@link SignupSchema} plus the optional
 * `referralCode`. It is the `POST /auth/signup` body contract; the API accepts a
 * non-empty code only from client type `web` — mobile and merchant signup keep
 * {@link SignupSchema} and never send one.
 */
export const ConsumerWebSignupSchema = SignupSchema.extend({
	referralCode: SignupReferralCodeInputSchema,
}).strict();

export type ConsumerWebSignupInput = z.output<typeof ConsumerWebSignupSchema>;

export const ForgotPasswordSchema = z
	.object({
		email: canonicalEmailSchema("Invalid email address").meta({
			description: "The email address associated with the user account",
			example: "user@example.com",
		}),
	})
	.strict();

export type ForgotPasswordInput = z.output<typeof ForgotPasswordSchema>;

/**
 * Which app a request comes from (matches `X-Client-Type`): the three browser
 * apps (`web`, `admin`, `merchant`) and the Expo app (`mobile`). It selects how
 * tokens travel — httpOnly cookies for browsers, JSON bodies for `mobile`
 * (ADR 029) — and never grants or removes a permission.
 */
export const AuthClientTypeSchema = z.enum(["web", "admin", "merchant", "mobile"]);

export type AuthClientType = z.output<typeof AuthClientTypeSchema>;

/** The browser client types — each has its own httpOnly cookie pair (`AUTH_COOKIE_NAMES`). */
export const BrowserClientTypeSchema = AuthClientTypeSchema.exclude(["mobile"]);

export type BrowserClientType = z.output<typeof BrowserClientTypeSchema>;

/** `true` for a browser client type (cookie transport); `false` for `mobile` (body transport). */
export function isBrowserClientType(clientType: AuthClientType): clientType is BrowserClientType {
	return BrowserClientTypeSchema.safeParse(clientType).success;
}

/**
 * How a client type receives and presents its tokens (ADR 029): `cookie` —
 * httpOnly cookies set by the API; `body` — the JSON response body, sent back
 * as `Authorization: Bearer` (access) and a request body (refresh).
 */
export const AuthTokenTransportSchema = z.enum(["cookie", "body"]);

export type AuthTokenTransport = z.output<typeof AuthTokenTransportSchema>;

/** The token transport of a client type — chosen by the server from the validated client type, never by a client flag. */
export function authTokenTransportOf(clientType: AuthClientType): AuthTokenTransport {
	return isBrowserClientType(clientType) ? AuthTokenTransportSchema.enum.cookie : AuthTokenTransportSchema.enum.body;
}

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

// ── Body token transport (client type `mobile`, ADR 029) ─────────────────

/** Upper bound on a refresh-token JWT presented in a request body (identity-only claims stay far below it). */
export const REFRESH_TOKEN_MAX_LENGTH = 4096;

/** A refresh-token JWT as a `mobile` client presents it. */
export const RefreshTokenValueSchema = z.string().min(1).max(REFRESH_TOKEN_MAX_LENGTH);

/**
 * Upper bound on an access-token JWT in a response body. Access tokens carry
 * the user's display claims (name, email), so they get more room than the
 * identity-only refresh token; the bound stops a malformed or hostile body
 * from being stored in a device's secret store.
 */
export const ACCESS_TOKEN_MAX_LENGTH = 8192;

/** An access-token JWT as the body token transport delivers it. */
export const AccessTokenValueSchema = z.string().min(1).max(ACCESS_TOKEN_MAX_LENGTH);

/**
 * The request body a `mobile` client sends to `POST /auth/refresh`,
 * `POST /auth/logout` and `POST /auth/logout-all`.
 */
export const RefreshTokenBodySchema = z
	.object({
		refreshToken: RefreshTokenValueSchema.meta({ description: "The refresh token (client type `mobile` only)", example: "eyJhbGciOiJIUzI1NiIs..." }),
	})
	.strict();

export type RefreshTokenBody = z.output<typeof RefreshTokenBodySchema>;

/**
 * Route input of `POST /auth/refresh`, `/auth/logout` and `/auth/logout-all`
 * for every client type: `mobile` sends `{ refreshToken }`; a browser sends an
 * empty body (or none — the edge proxy refresh sends no body), because its
 * refresh token travels in the httpOnly cookie. The API enforces which source
 * a client type may use (`refresh-token.guard.ts`): a body token from a browser
 * client type is rejected, and a `mobile` request never reads a cookie.
 */
export const RefreshTokenInputSchema = z
	.object({
		refreshToken: RefreshTokenValueSchema.optional().meta({
			description: "Required for client type `mobile`; must be absent for browser client types (their refresh token is the httpOnly cookie)",
			example: "eyJhbGciOiJIUzI1NiIs...",
		}),
	})
	.strict()
	.default({});

export type RefreshTokenInput = z.output<typeof RefreshTokenInputSchema>;

/**
 * The fields a token-bearing response carries for client type `mobile`:
 * the session tokens plus the `tokenTransport: "body"` marker.
 *
 * Only the API's token-delivery interceptor adds the marker, and only for a
 * `mobile` request. The marker is what lets the token-bearing variants of
 * the login / refresh contracts match: a browser response never carries it,
 * so a token that somehow remained in a browser body still falls to the
 * browser variant and is stripped by the response contract (defense in depth).
 */
export const BodyTokenFieldsSchema = z.object({
	tokenTransport: z.literal(AuthTokenTransportSchema.enum.body).meta({ description: "The tokens travel in this body (client type `mobile`)" }),
	accessToken: AccessTokenValueSchema.meta({ description: "Access token — send as `Authorization: Bearer`" }),
	refreshToken: RefreshTokenValueSchema.meta({ description: "Refresh token — present once to `POST /auth/refresh`; rotated on every use" }),
});

export type BodyTokenFields = z.output<typeof BodyTokenFieldsSchema>;

// ── Response Schemas ─────────────────────────────────────────────────────

export const LoginResponseSchema = z.object({
	user: UserResponseSchema,
});

export type LoginResponse = z.output<typeof LoginResponseSchema>;

/** A full login for client type `mobile`: the user plus the session tokens in the body. */
export const LoginMobileResponseSchema = LoginResponseSchema.extend(BodyTokenFieldsSchema.shape);

export type LoginMobileResponse = z.output<typeof LoginMobileResponseSchema>;

/** A restricted enrollment session for client type `mobile`: the enrollment result plus the session tokens in the body. */
export const LoginRestrictedEnrollmentMobileResponseSchema = LoginRestrictedEnrollmentClientResponseSchema.extend(BodyTokenFieldsSchema.shape);

export type LoginRestrictedEnrollmentMobileResponse = z.output<typeof LoginRestrictedEnrollmentMobileResponseSchema>;

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
 *
 * The token-bearing variants (client type `mobile`, ADR 029) come right before
 * their browser twin: they require `tokenTransport: "body"`, which only the
 * API's mobile transport adds, so a browser body — even one that still held a
 * token — never matches them and keeps being stripped to the browser variant.
 */
export const LoginClientResponseSchema = z.union([
	LoginRestrictedEnrollmentMobileResponseSchema,
	LoginRestrictedEnrollmentClientResponseSchema,
	LoginTwoFactorPendingResponseSchema,
	LoginVerificationPendingResponseSchema,
	LoginMobileResponseSchema,
	LoginResponseSchema,
]);

export type LoginClientResponse = z.output<typeof LoginClientResponseSchema>;

export const SignupResponseSchema = PlainMessageResponseSchema;

export type SignupResponse = z.output<typeof SignupResponseSchema>;

export const RefreshResponseMessageSchema = PlainMessageResponseSchema;

export type RefreshResponseMessage = z.output<typeof RefreshResponseMessageSchema>;

/** `POST /auth/refresh` for client type `mobile`: the message plus the rotated tokens in the body. */
export const RefreshMobileResponseSchema = RefreshResponseMessageSchema.extend(BodyTokenFieldsSchema.shape);

export type RefreshMobileResponse = z.output<typeof RefreshMobileResponseSchema>;

/**
 * The response contract of `POST /auth/refresh` for every client type: the
 * token-bearing `mobile` variant first (it requires `tokenTransport: "body"`),
 * then the browser `{ message }` (tokens set as httpOnly cookies, stripped
 * from the body).
 */
export const RefreshClientResponseSchema = z.union([RefreshMobileResponseSchema, RefreshResponseMessageSchema]);

export type RefreshClientResponse = z.output<typeof RefreshClientResponseSchema>;

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
