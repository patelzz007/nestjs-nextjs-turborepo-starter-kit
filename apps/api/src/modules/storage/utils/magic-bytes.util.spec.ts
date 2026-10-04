import { describe, expect, it } from "vitest";

import { assertAllowedUploadMime, detectMimeFromMagicBytes, UploadContentRejectedError, verifyMagicBytes } from "./magic-bytes.util";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBPVP8 ")]);
const AVIF_MAJOR = Buffer.concat([Buffer.from([0, 0, 0, 0x1c]), Buffer.from("ftypavif"), Buffer.from([0, 0, 0, 0]), Buffer.from("avifmif1miaf")]);
const AVIF_COMPATIBLE = Buffer.concat([Buffer.from([0, 0, 0, 0x1c]), Buffer.from("ftypmif1"), Buffer.from([0, 0, 0, 0]), Buffer.from("mif1avifmiaf")]);
const HEIC = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheic"), Buffer.from([0, 0, 0, 0]), Buffer.from("mif1heic")]);
const RIFF_WAVE = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WAVEfmt ")]);

describe("detectMimeFromMagicBytes", () => {
	it.each([
		["application/pdf", Buffer.from("%PDF-1.7 sample")],
		["image/png", PNG],
		["image/jpeg", JPEG],
		["image/webp", WEBP],
		["image/avif", AVIF_MAJOR],
		["image/avif", AVIF_COMPATIBLE],
	])("detects %s", (mimeType: string, buffer: Buffer) => {
		expect(detectMimeFromMagicBytes(buffer)).toBe(mimeType);
	});

	it.each([
		["HEIC (ISO-BMFF without an AVIF brand)", HEIC],
		["RIFF WAVE audio", RIFF_WAVE],
		["an HTML page", Buffer.from("<!doctype html><script>")],
		["an empty object", Buffer.alloc(0)],
	])("does not recognize %s", (_label: string, buffer: Buffer) => {
		expect(detectMimeFromMagicBytes(buffer)).toBeNull();
	});
});

describe("verifyMagicBytes", () => {
	it("rejects a declared MIME the bytes do not match", () => {
		expect(verifyMagicBytes(Buffer.from("%PDF-1.7 sample"), "application/pdf")).toBe(true);
		expect(verifyMagicBytes(Buffer.from("%PDF-1.7 sample"), "image/png")).toBe(false);
	});
});

describe("assertAllowedUploadMime", () => {
	it("returns the MIME type when it is allowed and matches the bytes", () => {
		expect(assertAllowedUploadMime(PNG, "image/png", ["image/png"])).toBe("image/png");
	});

	it("rejects a MIME type outside the allowlist", () => {
		expect(() => assertAllowedUploadMime(Buffer.from("%PDF-1.7"), "application/pdf", ["image/png"])).toThrow(new UploadContentRejectedError("MIME_NOT_ALLOWED"));
	});

	it("rejects content that lies about its type", () => {
		expect(() => assertAllowedUploadMime(Buffer.from("<html>"), "image/png", ["image/png"])).toThrow(new UploadContentRejectedError("MAGIC_BYTES_MISMATCH"));
	});
});
