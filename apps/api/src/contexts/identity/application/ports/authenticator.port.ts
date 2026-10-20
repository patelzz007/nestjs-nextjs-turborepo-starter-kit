import type { TotpSecretEncryptionContext } from "@workspace/shared";

import type { EncryptedTotpSecret, TotpVerification } from "../../domain/aggregates/two-factor-enrollment.aggregate";

/** TOTP (RFC 6238) secrets, codes and backup codes. */
export interface AuthenticatorPort {
	generateSecret(): string;
	/** The `otpauth://` key URI an authenticator app enrolls from. */
	keyUri(input: { readonly issuer: string; readonly label: string; readonly secret: string }): string;
	/** Checks `token` against `secret` (±1 period of clock skew); with `afterTimeStep`, a step at or before it is refused (replay). */
	verify(token: string, secret: string, afterTimeStep: number | null): TotpVerification;
	/** A fresh set of one-time backup codes (plaintext, shown once). */
	generateBackupCodes(): string[];
}

/** Encryption at rest of TOTP secrets (AES-256-GCM, versioned keys, the context as associated data). */
export interface TotpSecretCipherPort {
	encrypt(plaintext: string, context: TotpSecretEncryptionContext): EncryptedTotpSecret;
	decrypt(secret: EncryptedTotpSecret, context: TotpSecretEncryptionContext): string;
}
