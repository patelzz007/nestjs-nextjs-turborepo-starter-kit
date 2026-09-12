import type { DocumentMimeType } from "@workspace/shared";
import { DocumentMimeTypeSchema } from "@workspace/shared";

interface MagicMatch {
	readonly mimeType: DocumentMimeType;
	readonly bytes: readonly number[];
	readonly offset?: number;
}

const MAGIC_MATCHES: readonly MagicMatch[] = [
	{ mimeType: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] },
	{ mimeType: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
	{ mimeType: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
	{ mimeType: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 },
];

function matchesAtOffset(buffer: Buffer, bytes: readonly number[], offset: number): boolean {
	if (buffer.length < offset + bytes.length) {
		return false;
	}
	for (let index = 0; index < bytes.length; index += 1) {
		if (buffer[offset + index] !== bytes[index]) {
			return false;
		}
	}
	return true;
}

/** Detect MIME type from file magic bytes — returns null when unrecognized. */
export function detectMimeFromMagicBytes(buffer: Buffer): DocumentMimeType | null {
	for (const match of MAGIC_MATCHES) {
		const offset = match.offset ?? 0;
		if (matchesAtOffset(buffer, match.bytes, offset)) {
			if (match.mimeType === "image/webp") {
				const webpMarker = buffer.subarray(8, 12).toString("ascii");
				if (webpMarker !== "WEBP") {
					continue;
				}
			}
			return match.mimeType;
		}
	}
	return null;
}

/** Returns true when declared MIME matches magic-byte detection. */
export function verifyMagicBytes(buffer: Buffer, declaredMime: DocumentMimeType): boolean {
	const detected = detectMimeFromMagicBytes(buffer);
	return detected === declaredMime;
}

/** Validate buffer against an allowlisted MIME type (declared + magic bytes). */
export function assertAllowedUploadMime(buffer: Buffer, declaredMime: string, allowedMimeTypes: readonly DocumentMimeType[]): DocumentMimeType {
	const mimeParsed = DocumentMimeTypeSchema.safeParse(declaredMime);
	if (!mimeParsed.success || !allowedMimeTypes.includes(mimeParsed.data)) {
		throw new Error("INVALID_MIME");
	}
	if (!verifyMagicBytes(buffer, mimeParsed.data)) {
		throw new Error("MAGIC_BYTES_MISMATCH");
	}
	return mimeParsed.data;
}
