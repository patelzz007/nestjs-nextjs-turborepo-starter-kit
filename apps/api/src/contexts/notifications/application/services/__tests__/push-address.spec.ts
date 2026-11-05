import { describe, expect, it } from "vitest";

import type { PushTokenCipher } from "../../ports/push-token-cipher.port";
import { encryptInstallationId, pushAddressOf } from "../push-address";

/** A stand-in for the AES-GCM cipher with its one property that matters here: it opens only under the label it sealed with. */
const SEALED = /^sealed\((?<label>[^)]+)\):(?<value>.+)$/u;
const CIPHER: PushTokenCipher = {
	available: true,
	encrypt: (value: string, label: string): string => `sealed(${label}):${Buffer.from(value, "utf8").toString("base64")}`,
	decrypt: (ciphertext: string, label: string): string => {
		const groups = SEALED.exec(ciphertext)?.groups;
		if (groups?.label !== label || groups.value === undefined) {
			throw new Error("Sealed under another label");
		}
		return Buffer.from(groups.value, "base64").toString("utf8");
	},
};
const DEVICE_ID = "0193f2c4-0000-7000-8000-0000000000d1";
const FID = "fH3kVq9TzR1aB2cD3eF4g_";

describe("push address (enhancement 5.3)", () => {
	it("keeps the installation ID encrypted and reads it back with the token", () => {
		const installationIdCiphertext = encryptInstallationId(CIPHER, FID, DEVICE_ID);
		expect(installationIdCiphertext).not.toContain(FID);
		const device = { id: DEVICE_ID, tokenCiphertext: CIPHER.encrypt("fcm-token", DEVICE_ID), installationIdCiphertext };
		expect(pushAddressOf(CIPHER, device)).toStrictEqual({ token: "fcm-token", installationId: FID });
	});

	it("stores nothing for a device without one, and addresses it by token", () => {
		expect(encryptInstallationId(CIPHER, null, DEVICE_ID)).toBeNull();
		expect(pushAddressOf(CIPHER, { id: DEVICE_ID, tokenCiphertext: CIPHER.encrypt("fcm-token", DEVICE_ID), installationIdCiphertext: null })).toStrictEqual({
			token: "fcm-token",
			installationId: null,
		});
	});

	it("never opens the token's ciphertext as the installation ID (each is bound under its own label)", () => {
		const tokenCiphertext = CIPHER.encrypt("fcm-token", DEVICE_ID);
		expect(() => pushAddressOf(CIPHER, { id: DEVICE_ID, tokenCiphertext, installationIdCiphertext: tokenCiphertext })).toThrow();
	});
});
