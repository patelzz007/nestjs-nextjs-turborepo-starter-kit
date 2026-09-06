import * as crypto from "crypto";

import { InternalServerErrorException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";

import type { TypedConfigService } from "../../../config/typed-config.service";

import { SecretEncryptionService } from "./secret-encryption.service";

function makeKeyMaterial(seed: string): string {
	return crypto.createHash("sha256").update(seed).digest("base64");
}

describe("SecretEncryptionService", () => {
	const keyV1 = makeKeyMaterial("mfa-key-v1");
	const keyV2 = makeKeyMaterial("mfa-key-v2");

	let config: { mfaEncryptionKeys: Readonly<Record<number, string>> };
	let service: SecretEncryptionService;

	beforeEach(() => {
		config = { mfaEncryptionKeys: { 1: keyV1, 2: keyV2 } };
		service = new SecretEncryptionService(config as TypedConfigService);
	});

	it("round-trips encrypt and decrypt with the same context", () => {
		const plaintext = "JBSWY3DPEHPK3PXP";
		const encrypted = service.encrypt(plaintext, "totp-secret");

		const decrypted = service.decrypt(encrypted.ciphertext, encrypted.iv, encrypted.keyVersion, "totp-secret");

		expect(decrypted).toBe(plaintext);
		expect(encrypted.keyVersion).toBe(2);
	});

	it("fails decryption when the AAD context does not match", () => {
		const encrypted = service.encrypt("secret-value", "totp-pending");

		expect(() => service.decrypt(encrypted.ciphertext, encrypted.iv, encrypted.keyVersion, "totp-secret")).toThrow(InternalServerErrorException);
	});

	it("decrypts secrets encrypted with an older key version", () => {
		const legacyConfig = { mfaEncryptionKeys: { 1: keyV1 } };
		const legacyService = new SecretEncryptionService(legacyConfig as TypedConfigService);
		const encrypted = legacyService.encrypt("legacy-secret", "totp-secret");

		const rotatedConfig = { mfaEncryptionKeys: { 1: keyV1, 2: keyV2 } };
		const rotatedService = new SecretEncryptionService(rotatedConfig as TypedConfigService);
		const decrypted = rotatedService.decrypt(encrypted.ciphertext, encrypted.iv, encrypted.keyVersion, "totp-secret");

		expect(decrypted).toBe("legacy-secret");
		expect(encrypted.keyVersion).toBe(1);
	});
});
