// expo-crypto under Jest (jest.setup.ts): its randomUUID and digest are
// native, so the Web Crypto API Node provides globally stands in — the same
// RFC 4122 v4 UUIDs and the same SHA digests.

export function randomUUID(): string {
	return globalThis.crypto.randomUUID();
}

/** The algorithms the app digests with, named as expo-crypto names them (Web Crypto's names). */
export const CryptoDigestAlgorithm = { SHA256: "SHA-256" };

export function digest(algorithm: string, data: BufferSource): Promise<ArrayBuffer> {
	return globalThis.crypto.subtle.digest(algorithm, data);
}
