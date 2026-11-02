/** Encrypts push device tokens at rest (`NOTIFICATIONS_ENCRYPTION_KEYS`). */
export interface PushTokenCipher {
	readonly available: boolean;
	encrypt(token: string, deviceId: string): string;
	decrypt(ciphertext: string, deviceId: string): string;
}

export const PUSH_TOKEN_CIPHER = Symbol("PUSH_TOKEN_CIPHER");
