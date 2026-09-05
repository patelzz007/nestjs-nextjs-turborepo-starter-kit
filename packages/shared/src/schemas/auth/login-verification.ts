import { z } from "zod";

/** Six-digit login verification code sent by email for unrecognized devices. */
export const LoginVerificationCodeSchema = z
	.string()
	.length(6, "Code must be 6 digits")
	.regex(/^\d{6}$/, "Code must contain only digits");

export type LoginVerificationCode = z.output<typeof LoginVerificationCodeSchema>;

/** Returned when login credentials are valid but email verification is required. */
export const LoginVerificationPendingResponseSchema = z
	.object({
		requiresVerification: z.literal(true),
		verificationId: z.string().min(1),
		message: z.string(),
	})
	.strict();

export type LoginVerificationPendingResponse = z.output<typeof LoginVerificationPendingResponseSchema>;

export const VerifyLoginSchema = z
	.object({
		verificationId: z.string().min(1),
		code: LoginVerificationCodeSchema,
	})
	.strict();

export type VerifyLoginInput = z.output<typeof VerifyLoginSchema>;

export const ValidateResetTokenSchema = z
	.object({
		token: z.string().min(1, "Reset token is required"),
	})
	.strict();

export type ValidateResetTokenInput = z.output<typeof ValidateResetTokenSchema>;

export const ValidateResetTokenResponseSchema = z
	.object({
		valid: z.boolean(),
	})
	.strict();

export type ValidateResetTokenResponse = z.output<typeof ValidateResetTokenResponseSchema>;
