import { z } from "zod";

import { UserResponseSchema } from "./user";

// ── Password Validation ──────────────────────────────────────────────────

export const strongPassword = z
	.string()
	.min(8, "Password must be at least 8 characters")
	.regex(/[A-Z]/, "Password must contain at least one uppercase letter")
	.regex(/[a-z]/, "Password must contain at least one lowercase letter")
	.regex(/[0-9]/, "Password must contain at least one number")
	.regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character");

// ── Input Schemas ────────────────────────────────────────────────────────

export const LoginSchema = z
	.object({
		email: z.email("Invalid email address").meta({
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
		email: z.email("Invalid email address"),
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
		email: z.email("Invalid email address").meta({
			description: "The email address associated with the user account",
			example: "user@example.com",
		}),
	})
	.strict();

export type ForgotPasswordInput = z.output<typeof ForgotPasswordSchema>;

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
		email: z.email("Invalid email address").meta({
			description: "The email address to resend verification to",
			example: "user@example.com",
		}),
	})
	.strict();

export type ResendVerificationInput = z.output<typeof ResendVerificationSchema>;

// ── Session ──────────────────────────────────────────────────────────────

export const SessionSchema = z
	.object({
		id: z.string(),
		deviceInfo: z.string().nullable(),
		ipAddress: z.string().nullable(),
		expiresAt: z.string(),
		createdAt: z.string(),
	})
	.strict();

export type Session = z.output<typeof SessionSchema>;

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

export const LoginResponseSchema = z
	.object({
		user: UserResponseSchema,
	})
	.strict();

export type LoginResponse = z.output<typeof LoginResponseSchema>;

export const SignupResponseSchema = z
	.object({
		user: UserResponseSchema,
		verificationToken: z.string().optional(),
		message: z.string(),
	})
	.strict();

export type SignupResponse = z.output<typeof SignupResponseSchema>;

export const RefreshResponseMessageSchema = z
	.object({
		message: z.string(),
	})
	.strict();

export type RefreshResponseMessage = z.output<typeof RefreshResponseMessageSchema>;

export const LogoutResponseSchema = z
	.object({
		message: z.string(),
	})
	.strict();

export type LogoutResponse = z.output<typeof LogoutResponseSchema>;

export const LogoutAllResponseSchema = z
	.object({
		message: z.string(),
	})
	.strict();

export type LogoutAllResponse = z.output<typeof LogoutAllResponseSchema>;

export const ForgotPasswordResponseSchema = z
	.object({
		message: z.string(),
	})
	.strict();

export type ForgotPasswordResponse = z.output<typeof ForgotPasswordResponseSchema>;

export const ResetPasswordResponseSchema = z
	.object({
		message: z.string(),
	})
	.strict();

export type ResetPasswordResponse = z.output<typeof ResetPasswordResponseSchema>;

export const ResendVerificationResponseSchema = z
	.object({
		message: z.string(),
	})
	.strict();

export type ResendVerificationResponse = z.output<typeof ResendVerificationResponseSchema>;

export const VerifyEmailResponseSchema = z
	.object({
		message: z.string(),
	})
	.strict();

export type VerifyEmailResponse = z.output<typeof VerifyEmailResponseSchema>;

export const ImpersonateResponseSchema = z
	.object({
		accessToken: z.string(),
		message: z.string(),
		impersonating: z.literal(true),
		originalUserId: z.string(),
		user: UserResponseSchema,
	})
	.strict();

export type ImpersonateResponse = z.output<typeof ImpersonateResponseSchema>;

export const StopImpersonationResponseSchema = z
	.object({
		message: z.string(),
	})
	.strict();

export type StopImpersonationResponse = z.output<typeof StopImpersonationResponseSchema>;

// Re-exports for backward compatibility

export { SlimRoleSchema, PermissionDetailsSchema, UserResponseSchema } from "./user";
export type { SlimRoleResponse, PermissionDetailsResponse, UserResponse } from "./user";
