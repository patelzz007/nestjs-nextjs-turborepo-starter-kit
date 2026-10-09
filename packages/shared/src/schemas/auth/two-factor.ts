import { z } from "zod";
import { PlainMessageResponseSchema } from "../api/message";

/** Digits in a TOTP code from an authenticator app. */
export const TOTP_CODE_LENGTH = 6;

/** Six-digit TOTP code from an authenticator app. */
export const TotpCodeSchema = z
	.string()
	.length(TOTP_CODE_LENGTH, "Code must be 6 digits")
	.regex(new RegExp(`^\\d{${String(TOTP_CODE_LENGTH)}}$`), "Code must contain only digits");

export type TotpCode = z.output<typeof TotpCodeSchema>;

/** Backup-code alphabet: A–Z and 2–9, excluding the ambiguous 0/O and 1/I/L. Shared by the API generator and the client inputs. */
export const BACKUP_CODE_CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Characters in one backup code. */
export const BACKUP_CODE_LENGTH = 16;

/** Backup codes issued per enrollment / rotation. */
export const BACKUP_CODE_COUNT = 10;

export const BackupCodeSchema = z
	.string()
	.length(BACKUP_CODE_LENGTH, "Backup code must be 16 characters")
	.regex(new RegExp(`^[${BACKUP_CODE_CHARSET}]{${String(BACKUP_CODE_LENGTH)}}$`), "Backup code must use only unambiguous A–Z and 2–9 characters");

export type BackupCode = z.output<typeof BackupCodeSchema>;

/**
 * What a member typed into a backup-code field, reduced to the code itself:
 * upper-cased, separators and characters outside the alphabet dropped, cut
 * at `BACKUP_CODE_LENGTH`. Input normalization only — `BackupCodeSchema`
 * still validates the result.
 */
export function normalizeBackupCodeInput(raw: string): string {
	let normalized = "";
	for (const char of raw.toUpperCase()) {
		if (normalized.length === BACKUP_CODE_LENGTH) break;
		if (BACKUP_CODE_CHARSET.includes(char)) normalized += char;
	}
	return normalized;
}

/** Starting a 2FA enrollment takes no input: the server generates the secret and the codes. */
export const StartTwoFactorSetupSchema = z.object({}).strict();

export type StartTwoFactorSetupInput = z.output<typeof StartTwoFactorSetupSchema>;

/** Scheme of the key URI an authenticator app imports (`otpauth://totp/…`). */
export const OTP_AUTH_URL_PREFIX = "otpauth://";

/** A key URI: the `otpauth://` scheme (a pattern, not `startsWith`, so the JSON Schema stays a plain `pattern`). */
const OTP_AUTH_URL_PATTERN = /^otpauth:\/\//;

/** Upper bound on the key URI (issuer + account label + secret stay far below it). */
const OTP_AUTH_URL_MAX_LENGTH = 2048;

/** Response from `POST /auth/2fa/setup` (and `POST /auth/2fa/rotate`). */
export const TwoFactorSetupResponseSchema = z.object({
	secret: z.string().min(1),
	qrCodeDataUrl: z.string().min(1),
	/**
	 * The `otpauth://` key URI the QR code encodes. A phone cannot scan its own
	 * screen, so the mobile app hands this link to an installed authenticator
	 * app instead; the web apps keep showing the QR code.
	 */
	otpAuthUrl: z.string().max(OTP_AUTH_URL_MAX_LENGTH).regex(OTP_AUTH_URL_PATTERN, `must start with ${OTP_AUTH_URL_PREFIX}`),
	backupCodes: z.array(BackupCodeSchema).length(BACKUP_CODE_COUNT),
});

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

export const TwoFactorMessageResponseSchema = PlainMessageResponseSchema;

export type TwoFactorMessageResponse = z.output<typeof TwoFactorMessageResponseSchema>;

export const VerifyBackupCodeResponseSchema = z.object({
	valid: z.boolean(),
});

export type VerifyBackupCodeResponse = z.output<typeof VerifyBackupCodeResponseSchema>;

export const BackupCodesRemainingResponseSchema = z.object({
	remaining: z.number().int().nonnegative(),
});

export type BackupCodesRemainingResponse = z.output<typeof BackupCodesRemainingResponseSchema>;

/** Returned by `POST /auth/login` when 2FA is required before issuing cookies. */
export const LoginTwoFactorPendingResponseSchema = z.object({
	requiresTwoFactor: z.literal(true),
	tempToken: z.string().min(1),
	message: z.string(),
});

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
