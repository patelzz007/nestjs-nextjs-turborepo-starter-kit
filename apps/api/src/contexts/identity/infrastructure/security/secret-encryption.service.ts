import * as crypto from "crypto";

import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { TotpSecretEncryptionContextSchema, type TotpSecretEncryptionContext } from "@workspace/shared";

import { TypedConfigService } from "../../../../config/typed-config.service";
import type { TotpSecretCipherPort } from "../../application/ports/authenticator.port";
import type { EncryptedTotpSecret } from "../../domain/aggregates/two-factor-enrollment.aggregate";

const AES_GCM_IV_BYTES = 12;
const AES_GCM_AUTH_TAG_BYTES = 16;
const AES_256_KEY_BYTES = 32;

@Injectable()
/** AES-256-GCM encryption of TOTP secrets at rest, with versioned keys and the context as associated data. */
export class SecretEncryptionService implements TotpSecretCipherPort {
	private readonly currentKeyVersion: number;

	public constructor(private readonly config: TypedConfigService) {
		this.currentKeyVersion = this.resolveCurrentKeyVersion(this.config.mfa.encryptionKeys);
	}

	public encrypt(plaintext: string, context: TotpSecretEncryptionContext): EncryptedTotpSecret {
		const validatedContext = TotpSecretEncryptionContextSchema.parse(context);
		const keyMaterial = this.requireKeyMaterial(this.config.mfa.encryptionKeys, this.currentKeyVersion);
		const key = this.decodeKeyMaterial(keyMaterial, this.currentKeyVersion);
		const iv = crypto.randomBytes(AES_GCM_IV_BYTES);
		const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
		cipher.setAAD(Buffer.from(validatedContext, "utf8"));

		const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
		const authTag = cipher.getAuthTag();
		const ciphertext = Buffer.concat([encrypted, authTag]).toString("base64");

		return {
			ciphertext,
			iv: iv.toString("base64"),
			keyVersion: this.currentKeyVersion,
		};
	}

	public decrypt(secret: EncryptedTotpSecret, context: TotpSecretEncryptionContext): string {
		const { ciphertext, iv, keyVersion } = secret;
		const validatedContext = TotpSecretEncryptionContextSchema.parse(context);
		const keyMaterial = this.requireKeyMaterial(this.config.mfa.encryptionKeys, keyVersion);
		const key = this.decodeKeyMaterial(keyMaterial, keyVersion);
		const ivBuffer = Buffer.from(iv, "base64");
		if (ivBuffer.length !== AES_GCM_IV_BYTES) {
			throw new InternalServerErrorException("Invalid MFA secret IV length");
		}

		const combined = Buffer.from(ciphertext, "base64");
		if (combined.length <= AES_GCM_AUTH_TAG_BYTES) {
			throw new InternalServerErrorException("Invalid MFA secret ciphertext");
		}

		const authTag = combined.subarray(combined.length - AES_GCM_AUTH_TAG_BYTES);
		const encrypted = combined.subarray(0, combined.length - AES_GCM_AUTH_TAG_BYTES);
		const decipher = crypto.createDecipheriv("aes-256-gcm", key, ivBuffer);
		decipher.setAAD(Buffer.from(validatedContext, "utf8"));
		decipher.setAuthTag(authTag);

		try {
			return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
		} catch {
			throw new InternalServerErrorException("Failed to decrypt MFA secret");
		}
	}

	private resolveCurrentKeyVersion(keys: Readonly<Record<number, string>>): number {
		const versions = Object.keys(keys)
			.map((versionKey: string): number => Number.parseInt(versionKey, 10))
			.filter((version: number): boolean => Number.isInteger(version) && version >= 1);

		if (versions.length === 0) {
			throw new InternalServerErrorException("No MFA encryption keys configured");
		}

		return Math.max(...versions);
	}

	private requireKeyMaterial(keys: Readonly<Record<number, string>>, keyVersion: number): string {
		const keyMaterial: string | undefined = keys[keyVersion];
		if (keyMaterial === undefined || keyMaterial.length === 0) {
			throw new InternalServerErrorException(`Missing MFA encryption key for version ${String(keyVersion)}`);
		}
		return keyMaterial;
	}

	private decodeKeyMaterial(keyMaterial: string, keyVersion: number): Buffer {
		const decoded = Buffer.from(keyMaterial, "base64");
		if (decoded.length === AES_256_KEY_BYTES) {
			return decoded;
		}

		throw new InternalServerErrorException(`MFA encryption key version ${String(keyVersion)} must decode to 32 bytes`);
	}
}
