import { renderQrSvg, type TwoFactorSetupResponse } from "@workspace/shared";

import type { EncryptedTotpSecret } from "../../domain/aggregates/two-factor-enrollment.aggregate";
import type { AuthenticatorPort, TotpSecretCipherPort } from "../ports/authenticator.port";
import type { CredentialCryptoPort } from "../ports/credential-crypto.port";

/** The setup QR is the shared encoder's standalone SVG, base64-encoded into a data URL any `<img>` can show. */
export const TWO_FACTOR_QR_DATA_URL_PREFIX = "data:image/svg+xml;base64,";

/** A freshly generated setup: what is stored (encrypted secret, hashes) and what the user sees once. */
export interface GeneratedTwoFactorSetup {
	readonly encryptedSecret: EncryptedTotpSecret;
	readonly backupCodeHashes: readonly string[];
	readonly response: TwoFactorSetupResponse;
}

/** Generates a TOTP secret, its key URI and QR code, and a backup-code set (stored as bcrypt hashes). */
export async function generateTwoFactorSetup(
	ports: { readonly authenticator: AuthenticatorPort; readonly cipher: TotpSecretCipherPort; readonly crypto: CredentialCryptoPort },
	label: { readonly issuer: string; readonly email: string },
): Promise<GeneratedTwoFactorSetup> {
	const secret: string = ports.authenticator.generateSecret();
	const backupCodes: string[] = ports.authenticator.generateBackupCodes();
	const backupCodeHashes: string[] = await Promise.all(backupCodes.map((code: string): Promise<string> => ports.crypto.hash(code)));
	const otpAuthUrl: string = ports.authenticator.keyUri({ issuer: label.issuer, label: label.email, secret });
	const qrCodeDataUrl = `${TWO_FACTOR_QR_DATA_URL_PREFIX}${Buffer.from(renderQrSvg(otpAuthUrl), "utf8").toString("base64")}`;
	// The key URI is returned as well as encoded in the QR code: a phone cannot scan its own screen,
	// so the mobile app opens this link in the installed authenticator app instead.
	return {
		encryptedSecret: ports.cipher.encrypt(secret, "totp-pending"),
		backupCodeHashes,
		response: { secret, qrCodeDataUrl, otpAuthUrl, backupCodes },
	};
}

/** The first unused backup code of the account matching `backupCode` (bcrypt-compared one by one), or `null`. */
export async function findMatchingBackupCode(
	crypto: CredentialCryptoPort,
	codes: readonly { readonly id: string; readonly codeHash: string }[],
	backupCode: string,
): Promise<string | null> {
	for (const code of codes) {
		if (await crypto.compare(backupCode, code.codeHash)) {
			return code.id;
		}
	}
	return null;
}
