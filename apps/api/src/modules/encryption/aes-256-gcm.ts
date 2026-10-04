import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** AES-256-GCM, the only cipher tenant envelope encryption uses. */
const ALGORITHM = "aes-256-gcm";
/** 96-bit IV — the GCM-recommended nonce size. */
export const GCM_IV_BYTES = 12;
/** Full 128-bit authentication tag; set explicitly on cipher AND decipher so a truncated tag is rejected. */
export const GCM_AUTH_TAG_BYTES = 16;
/** AES-256 key size. */
export const AES_256_KEY_BYTES = 32;

const ENVELOPE_SEPARATOR = ":";
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

/** IV, authentication tag and ciphertext of one AES-256-GCM encryption. */
export interface GcmEnvelope {
	readonly iv: Buffer;
	readonly tag: Buffer;
	readonly data: Buffer;
}

/** A stored envelope that cannot be parsed or does not authenticate. */
export class GcmEnvelopeError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "GcmEnvelopeError";
	}
}

export function gcmEncrypt(key: Buffer, plaintext: Buffer): GcmEnvelope {
	const iv = randomBytes(GCM_IV_BYTES);
	const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: GCM_AUTH_TAG_BYTES });
	const data = Buffer.concat([cipher.update(plaintext), cipher.final()]);
	return { iv, tag: cipher.getAuthTag(), data };
}

/** Decrypts and authenticates; throws when the tag does not verify (wrong key or tampered data). */
export function gcmDecrypt(key: Buffer, envelope: GcmEnvelope): Buffer {
	if (envelope.iv.length !== GCM_IV_BYTES || envelope.tag.length !== GCM_AUTH_TAG_BYTES) {
		throw new GcmEnvelopeError("Malformed envelope: unexpected IV or authentication tag length");
	}
	const decipher = createDecipheriv(ALGORITHM, key, envelope.iv, { authTagLength: GCM_AUTH_TAG_BYTES });
	decipher.setAuthTag(envelope.tag);
	try {
		return Buffer.concat([decipher.update(envelope.data), decipher.final()]);
	} catch (error) {
		throw new GcmEnvelopeError(`Envelope failed authentication: ${error instanceof Error ? error.message : "decipher error"}`);
	}
}

/** `iv:tag:data`, each part standard base64. */
export function formatGcmEnvelope(envelope: GcmEnvelope): string {
	return [envelope.iv, envelope.tag, envelope.data].map((part: Buffer): string => part.toString("base64")).join(ENVELOPE_SEPARATOR);
}

export function parseGcmEnvelope(serialized: string): GcmEnvelope {
	const parts: string[] = serialized.split(ENVELOPE_SEPARATOR);
	const [iv, tag, data] = parts;
	if (parts.length !== 3 || iv === undefined || tag === undefined || data === undefined || !parts.every((part: string): boolean => BASE64_PATTERN.test(part))) {
		throw new GcmEnvelopeError("Malformed envelope: expected base64 iv:tag:ciphertext");
	}
	return { iv: Buffer.from(iv, "base64"), tag: Buffer.from(tag, "base64"), data: Buffer.from(data, "base64") };
}
