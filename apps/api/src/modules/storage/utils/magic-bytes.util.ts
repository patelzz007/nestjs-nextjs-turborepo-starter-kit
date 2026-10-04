import type { DocumentMimeType } from "@workspace/shared";
import { DocumentMimeTypeSchema } from "@workspace/shared";

/** Leading bytes needed to recognize every supported type (the ISO-BMFF `ftyp` box of AVIF is the longest). */
export const MAGIC_BYTES_PREFIX_LENGTH = 64;

interface MagicMatch {
	readonly mimeType: DocumentMimeType;
	readonly bytes: readonly number[];
}

const MAGIC_MATCHES: readonly MagicMatch[] = [
	{ mimeType: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] },
	{ mimeType: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
	{ mimeType: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];

/** RIFF container header; a WebP file carries "WEBP" at bytes 8–11. */
const RIFF_SIGNATURE = "RIFF";
const WEBP_FORM_TYPE = "WEBP";
const RIFF_FORM_TYPE_OFFSET = 8;

/** ISO-BMFF: box size (4 bytes), "ftyp" (4 bytes), major brand (4 bytes), minor version (4 bytes), compatible brands. */
const FTYP_BOX_TYPE = "ftyp";
const FTYP_TYPE_OFFSET = 4;
const FTYP_MAJOR_BRAND_OFFSET = 8;
const FTYP_COMPATIBLE_BRANDS_OFFSET = 16;
const BRAND_LENGTH = 4;
const AVIF_BRANDS: ReadonlySet<string> = new Set<string>(["avif", "avis"]);

function asciiAt(buffer: Buffer, offset: number, length: number): string {
	if (buffer.length < offset + length) {
		return "";
	}
	return buffer.subarray(offset, offset + length).toString("latin1");
}

function startsWithBytes(buffer: Buffer, bytes: readonly number[]): boolean {
	if (buffer.length < bytes.length) {
		return false;
	}
	return bytes.every((byte: number, index: number): boolean => buffer[index] === byte);
}

function isWebp(buffer: Buffer): boolean {
	return asciiAt(buffer, 0, RIFF_SIGNATURE.length) === RIFF_SIGNATURE && asciiAt(buffer, RIFF_FORM_TYPE_OFFSET, WEBP_FORM_TYPE.length) === WEBP_FORM_TYPE;
}

function isAvif(buffer: Buffer): boolean {
	if (asciiAt(buffer, FTYP_TYPE_OFFSET, FTYP_BOX_TYPE.length) !== FTYP_BOX_TYPE) {
		return false;
	}
	if (AVIF_BRANDS.has(asciiAt(buffer, FTYP_MAJOR_BRAND_OFFSET, BRAND_LENGTH))) {
		return true;
	}
	const boxEnd = Math.min(buffer.readUInt32BE(0), buffer.length);
	for (let offset = FTYP_COMPATIBLE_BRANDS_OFFSET; offset + BRAND_LENGTH <= boxEnd; offset += BRAND_LENGTH) {
		if (AVIF_BRANDS.has(asciiAt(buffer, offset, BRAND_LENGTH))) {
			return true;
		}
	}
	return false;
}

/** Detect MIME type from file magic bytes — returns null when unrecognized. */
export function detectMimeFromMagicBytes(buffer: Buffer): DocumentMimeType | null {
	for (const match of MAGIC_MATCHES) {
		if (startsWithBytes(buffer, match.bytes)) {
			return match.mimeType;
		}
	}
	if (isWebp(buffer)) {
		return "image/webp";
	}
	if (isAvif(buffer)) {
		return "image/avif";
	}
	return null;
}

/** Returns true when declared MIME matches magic-byte detection. */
export function verifyMagicBytes(buffer: Buffer, declaredMime: DocumentMimeType): boolean {
	return detectMimeFromMagicBytes(buffer) === declaredMime;
}

/** Why uploaded content was rejected before it was accepted into storage. */
export type UploadContentRejection = "MIME_NOT_ALLOWED" | "MAGIC_BYTES_MISMATCH";

export class UploadContentRejectedError extends Error {
	public constructor(public readonly reason: UploadContentRejection) {
		super(reason === "MIME_NOT_ALLOWED" ? "Declared MIME type is not allowed" : "File content does not match its declared MIME type");
		this.name = "UploadContentRejectedError";
	}
}

/** Validate leading bytes against an allowlisted MIME type (declared + magic bytes). */
export function assertAllowedUploadMime(prefix: Buffer, declaredMime: string, allowedMimeTypes: readonly DocumentMimeType[]): DocumentMimeType {
	const mimeParsed = DocumentMimeTypeSchema.safeParse(declaredMime);
	if (!mimeParsed.success || !allowedMimeTypes.includes(mimeParsed.data)) {
		throw new UploadContentRejectedError("MIME_NOT_ALLOWED");
	}
	if (!verifyMagicBytes(prefix, mimeParsed.data)) {
		throw new UploadContentRejectedError("MAGIC_BYTES_MISMATCH");
	}
	return mimeParsed.data;
}
