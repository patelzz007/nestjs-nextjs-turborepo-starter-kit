// ============================================
// Where a push goes (enhancement 5.3): the device's token, and on Android its Firebase Installation ID
// ============================================
// FCM deprecates sending by token (firebase-admin 14) in favour of the installation ID, so an Android
// device that reported its ID is sent by it; one registered by an older app build still goes by token.
// The ID is encrypted at rest like the token, bound to its row under its own label, so a token's
// ciphertext copied into the ID's column never decrypts.

import type { PushTokenCipher } from "../ports/push-token-cipher.port";

/** The token and the installation ID of one device, as a sender addresses it. */
export interface PushAddress {
	readonly token: string;
	/** Android's Firebase Installation ID; null on iOS and for an app build that didn't report it. */
	readonly installationId: string | null;
}

/** The authenticated label of a device's installation ID (the token's is the bare device id). */
function installationIdLabel(deviceId: string): string {
	return `${deviceId}#installation-id`;
}

export function encryptInstallationId(cipher: PushTokenCipher, installationId: string | null, deviceId: string): string | null {
	return installationId === null ? null : cipher.encrypt(installationId, installationIdLabel(deviceId));
}

/** A stored device's address, decrypted. */
export function pushAddressOf(
	cipher: PushTokenCipher,
	device: { readonly id: string; readonly tokenCiphertext: string; readonly installationIdCiphertext: string | null },
): PushAddress {
	return {
		token: cipher.decrypt(device.tokenCiphertext, device.id),
		installationId: device.installationIdCiphertext === null ? null : cipher.decrypt(device.installationIdCiphertext, installationIdLabel(device.id)),
	};
}
