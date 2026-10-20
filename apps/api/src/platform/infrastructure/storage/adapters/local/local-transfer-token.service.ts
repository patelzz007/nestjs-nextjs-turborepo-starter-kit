import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { DocumentMimeTypeSchema, FileDownloadDispositionSchema } from "@workspace/shared";
import { z } from "zod";

/** HMAC-SHA256 key length (bytes). */
const SIGNING_KEY_BYTES = 32;
const MS_PER_SECOND = 1_000;
const TOKEN_ENCODING = "base64url";
const TOKEN_SEPARATOR = ".";
const SHA256_HEX_LENGTH = 64;

const DownloadTokenPayloadSchema = z
	.object({
		operation: z.literal("download"),
		fileId: z.uuid(),
		container: z.string().min(1),
		path: z.string().min(1),
		expiresAt: z.number().int().positive(),
		disposition: FileDownloadDispositionSchema.nullable(),
		fileName: z.string().min(1).nullable(),
	})
	.strict();

const UploadTokenPayloadSchema = z
	.object({
		operation: z.literal("upload"),
		fileId: z.uuid(),
		container: z.string().min(1),
		path: z.string().min(1),
		expiresAt: z.number().int().positive(),
		maxBytes: z.number().int().positive(),
		mimeType: DocumentMimeTypeSchema,
		checksumSha256: z.string().length(SHA256_HEX_LENGTH),
	})
	.strict();

const LocalTransferTokenPayloadSchema = z.discriminatedUnion("operation", [DownloadTokenPayloadSchema, UploadTokenPayloadSchema]);

export type LocalDownloadTokenPayload = z.output<typeof DownloadTokenPayloadSchema>;
export type LocalUploadTokenPayload = z.output<typeof UploadTokenPayloadSchema>;
type LocalTransferTokenPayload = z.output<typeof LocalTransferTokenPayloadSchema>;

export type LocalTransferTokenRejection = "MALFORMED" | "BAD_SIGNATURE" | "EXPIRED" | "WRONG_OPERATION";

export class LocalTransferTokenError extends Error {
	public constructor(
		public readonly reason: LocalTransferTokenRejection,
		options?: ErrorOptions,
	) {
		super(`Local transfer token rejected: ${reason}`, options);
		this.name = "LocalTransferTokenError";
	}
}

/**
 * Signs and verifies the capability tokens the local storage driver puts in
 * its upload and download URLs — the local equivalent of an S3 presigned URL.
 *
 * A token binds ONE operation to ONE file id + container + object key and
 * expires. It is an HMAC over the encoded payload with a key generated per API
 * process: the local driver is a single-process development backend
 * (production rejects STORAGE_PROVIDER=local), and links are short-lived, so
 * a restart simply invalidates outstanding links instead of requiring yet
 * another secret in every developer's .env.
 *
 * Registered as a singleton (StorageModule) so the adapter that signs and the
 * controller that verifies share one key.
 */
export class LocalTransferTokenService {
	private readonly signingKey: Buffer = randomBytes(SIGNING_KEY_BYTES);

	public constructor(private readonly now: () => number = Date.now) {}

	public signDownload(input: Omit<LocalDownloadTokenPayload, "operation" | "expiresAt">, expiresInSeconds: number): string {
		return this.sign({ ...input, operation: "download", expiresAt: this.expiry(expiresInSeconds) });
	}

	public signUpload(input: Omit<LocalUploadTokenPayload, "operation" | "expiresAt">, expiresInSeconds: number): string {
		return this.sign({ ...input, operation: "upload", expiresAt: this.expiry(expiresInSeconds) });
	}

	public verifyDownload(token: string): LocalDownloadTokenPayload {
		const payload = this.verify(token);
		if (payload.operation !== "download") {
			throw new LocalTransferTokenError("WRONG_OPERATION");
		}
		return payload;
	}

	public verifyUpload(token: string): LocalUploadTokenPayload {
		const payload = this.verify(token);
		if (payload.operation !== "upload") {
			throw new LocalTransferTokenError("WRONG_OPERATION");
		}
		return payload;
	}

	private expiry(expiresInSeconds: number): number {
		return this.now() + expiresInSeconds * MS_PER_SECOND;
	}

	private sign(payload: LocalTransferTokenPayload): string {
		const encoded = Buffer.from(JSON.stringify(LocalTransferTokenPayloadSchema.parse(payload)), "utf8").toString(TOKEN_ENCODING);
		return `${encoded}${TOKEN_SEPARATOR}${this.mac(encoded).toString(TOKEN_ENCODING)}`;
	}

	private verify(token: string): LocalTransferTokenPayload {
		const parts = token.split(TOKEN_SEPARATOR);
		const [encoded, signature] = parts;
		if (parts.length !== 2 || encoded === undefined || signature === undefined || encoded.length === 0) {
			throw new LocalTransferTokenError("MALFORMED");
		}
		const expected = this.mac(encoded);
		const provided = Buffer.from(signature, TOKEN_ENCODING);
		if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
			throw new LocalTransferTokenError("BAD_SIGNATURE");
		}
		const payload = this.decode(encoded);
		if (payload.expiresAt <= this.now()) {
			throw new LocalTransferTokenError("EXPIRED");
		}
		return payload;
	}

	private decode(encoded: string): LocalTransferTokenPayload {
		try {
			// Signature already verified: the payload is ours, but it is still parsed, never trusted blindly.
			return LocalTransferTokenPayloadSchema.parse(JSON.parse(Buffer.from(encoded, TOKEN_ENCODING).toString("utf8")));
		} catch (error) {
			throw new LocalTransferTokenError("MALFORMED", { cause: error });
		}
	}

	private mac(encoded: string): Buffer {
		return createHmac("sha256", this.signingKey).update(encoded).digest();
	}
}
