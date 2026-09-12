import { describe, expect, it } from "vitest";

import { detectMimeFromMagicBytes, verifyMagicBytes } from "./magic-bytes.util";

describe("magic-bytes", () => {
	it("detects PDF magic bytes", () => {
		const buffer = Buffer.from("%PDF-1.7 sample");
		expect(detectMimeFromMagicBytes(buffer)).toBe("application/pdf");
		expect(verifyMagicBytes(buffer, "application/pdf")).toBe(true);
	});

	it("rejects mismatched MIME", () => {
		const buffer = Buffer.from("%PDF-1.7 sample");
		expect(verifyMagicBytes(buffer, "image/png")).toBe(false);
	});
});
