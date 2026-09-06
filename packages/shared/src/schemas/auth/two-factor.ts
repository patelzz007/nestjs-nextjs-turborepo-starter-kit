import { z } from "zod";

/** Six-digit TOTP code from an authenticator app. */
export const TotpCodeSchema = z
	.string()
	.length(6, "Code must be 6 digits")
	.regex(/^\d{6}$/, "Code must contain only digits");

export type TotpCode = z.output<typeof TotpCodeSchema>;

/** Alphanumeric backup code (16 chars, A–Z and 2–9, excluding ambiguous characters). */
const BACKUP_CODE_CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export const BackupCodeSchema = z
	.string()
	.length(16, "Backup code must be 16 characters")
	.regex(new RegExp(`^[${BACKUP_CODE_CHARSET}]{16}$`), "Backup code must use only unambiguous A–Z and 2–9 characters");

export type BackupCode = z.output<typeof BackupCodeSchema>;

/** Response from `GET /auth/2fa/setup`. */
export const TwoFactorSetupResponseSchema = z
	.object({
		secret: z.string().min(1),
		qrCodeDataUrl: z.string().min(1),
		backupCodes: z.array(BackupCodeSchema).length(10),
	})
	.strict();

export type TwoFactorSetupResponse = z.output<typeof TwoFactorSetupResponseSchema>;

export const EnableTwoFactorSchema = z
	.object({
		token: TotpCodeSchema,
	})
	.strict();

export type EnableTwoFactorInput = z.output<typeof EnableTwoFactorSchema>;

export const RotateTwoFactorSchema = z
	.object({
		password: z.string().min(1, "Password is required"),
		token: TotpCodeSchema.optional(),
		backupCode: BackupCodeSchema.optional(),
	})
	.strict()
	.refine((data) => (data.token !== undefined && data.backupCode === undefined) || (data.token === undefined && data.backupCode !== undefined), {
		message: "Provide exactly one of token or backupCode",
	});

export type RotateTwoFactorInput = z.output<typeof RotateTwoFactorSchema>;

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

export const BackupCodesRemainingResponseSchema = z
	.object({
		remaining: z.number().int().nonnegative(),
	})
	.strict();

export type BackupCodesRemainingResponse = z.output<typeof BackupCodesRemainingResponseSchema>;

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

/** AES-GCM additional authenticated data label for TOTP secret encryption. */
export const TotpSecretEncryptionContextSchema = z.enum(["totp-secret", "totp-pending"]);

export type TotpSecretEncryptionContext = z.output<typeof TotpSecretEncryptionContextSchema>;

/** Versioned MFA field encryption keys from `MFA_ENCRYPTION_KEYS` JSON env. */
export const MfaEncryptionKeysSchema = z.record(z.string().min(1), z.string().min(1));

export type MfaEncryptionKeys = z.output<typeof MfaEncryptionKeysSchema>;

/** JWT payload for an opaque MFA login / rotation challenge reference. */
export const TwoFactorChallengeRefPayloadSchema = z
	.object({
		sub: z.string().min(1),
		challengeId: z.uuid(),
		purpose: z.enum(["LOGIN", "ROTATE"]),
		clientType: z.string().nullable(),
		deviceInfo: z.string().nullable(),
		ipAddress: z.string().nullable(),
		iat: z.number().optional(),
		exp: z.number().optional(),
	})
	.strict();

export type TwoFactorChallengeRefPayload = z.output<typeof TwoFactorChallengeRefPayloadSchema>;
