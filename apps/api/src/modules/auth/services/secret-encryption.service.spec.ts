import * as crypto from "crypto";

import { InternalServerErrorException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TypedConfigService } from "../../../config/typed-config.service";

import { SecretEncryptionService } from "./secret-encryption.service";
import { createTestApiConfig } from "../../../../test/support/test-api-env";

const configState = vi.hoisted(() => {
	const state: { mfaEncryptionKeys: Readonly<Record<number, string>> } = { mfaEncryptionKeys: {} };
	return state;
});

vi.mock("../../../config/typed-config.service", () => ({
	TypedConfigService: class {
		/** Snapshot at construction so each service instance keeps its own key ring. */
		public readonly mfa = { encryptionKeys: configState.mfaEncryptionKeys };
	},
}));

function configWithKeys(keys: Readonly<Record<number, string>>): TypedConfigService {
	configState.mfaEncryptionKeys = keys;
	return new TypedConfigService(createTestApiConfig());
}

function makeKeyMaterial(seed: string): string {
	return crypto.createHash("sha256").update(seed).digest("base64");
}

describe("SecretEncryptionService", () => {
	const keyV1 = makeKeyMaterial("mfa-key-v1");
	const keyV2 = makeKeyMaterial("mfa-key-v2");

	let service: SecretEncryptionService;

	beforeEach(() => {
		service = new SecretEncryptionService(configWithKeys({ 1: keyV1, 2: keyV2 }));
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
		const legacyService = new SecretEncryptionService(configWithKeys({ 1: keyV1 }));
		const encrypted = legacyService.encrypt("legacy-secret", "totp-secret");

		const rotatedService = new SecretEncryptionService(configWithKeys({ 1: keyV1, 2: keyV2 }));
		const decrypted = rotatedService.decrypt(encrypted.ciphertext, encrypted.iv, encrypted.keyVersion, "totp-secret");

		expect(decrypted).toBe("legacy-secret");
		expect(encrypted.keyVersion).toBe(1);
	});
});
