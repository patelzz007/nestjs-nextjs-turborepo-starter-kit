import { z } from "zod";

/** Six-digit TOTP code from an authenticator app. */
export const TotpCodeSchema = z
	.string()
	.length(6, "Code must be 6 digits")
	.regex(/^\d{6}$/, "Code must contain only digits");

export type TotpCode = z.output<typeof TotpCodeSchema>;

/** Eight-digit backup code (Luhn checksum digit included). */
export const BackupCodeSchema = z
	.string()
	.length(8, "Backup code must be 8 digits")
	.regex(/^\d{8}$/, "Backup code must contain only digits");

export type BackupCode = z.output<typeof BackupCodeSchema>;

/** Response from `GET /auth/2fa/setup`. */
export const TwoFactorSetupResponseSchema = z
	.object({
		secret: z.string().min(1),
		qrCodeDataUrl: z.string().min(1),
		backupCodes: z.array(z.string().min(1)).length(8),
	})
	.strict();

export type TwoFactorSetupResponse = z.output<typeof TwoFactorSetupResponseSchema>;

export const EnableTwoFactorSchema = z
	.object({
		token: TotpCodeSchema,
	})
	.strict();

export type EnableTwoFactorInput = z.output<typeof EnableTwoFactorSchema>;

export const DisableTwoFactorSchema = z
	.object({
		password: z.string().min(1, "Password is required"),
	})
	.strict();

export type DisableTwoFactorInput = z.output<typeof DisableTwoFactorSchema>;

export const VerifyBackupCodeSchema = z
	.object({
		backupCode: BackupCodeSchema,
	})
	.strict();

export type VerifyBackupCodeInput = z.output<typeof VerifyBackupCodeSchema>;

export const LoginTwoFactorSchema = z
	.object({
		tempToken: z.string().min(1),
		token: TotpCodeSchema,
	})
	.strict();

export type LoginTwoFactorInput = z.output<typeof LoginTwoFactorSchema>;

export const VerifyBackupCodeLoginSchema = z
	.object({
		tempToken: z.string().min(1),
		backupCode: BackupCodeSchema,
	})
	.strict();

export type VerifyBackupCodeLoginInput = z.output<typeof VerifyBackupCodeLoginSchema>;

export const TwoFactorMessageResponseSchema = z
	.object({
		message: z.string(),
	})
	.strict();

export type TwoFactorMessageResponse = z.output<typeof TwoFactorMessageResponseSchema>;

export const VerifyBackupCodeResponseSchema = z
	.object({
		valid: z.boolean(),
	})
	.strict();

export type VerifyBackupCodeResponse = z.output<typeof VerifyBackupCodeResponseSchema>;

/** Returned by `POST /auth/login` when 2FA is required before issuing cookies. */
export const LoginTwoFactorPendingResponseSchema = z
	.object({
		requiresTwoFactor: z.literal(true),
		tempToken: z.string().min(1),
		message: z.string(),
	})
	.strict();

export type LoginTwoFactorPendingResponse = z.output<typeof LoginTwoFactorPendingResponseSchema>;

/** JWT payload for the short-lived 2FA login step. */
export const TwoFactorPendingTokenPayloadSchema = z.object({
	sub: z.string(),
	purpose: z.literal("two_factor_login"),
	clientType: z.string().nullable(),
	deviceInfo: z.string().nullable(),
	ipAddress: z.string().nullable(),
	iat: z.number().optional(),
	exp: z.number().optional(),
});

export type TwoFactorPendingTokenPayload = z.output<typeof TwoFactorPendingTokenPayloadSchema>;
