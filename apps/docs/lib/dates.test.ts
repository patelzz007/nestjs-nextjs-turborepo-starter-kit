import { describe, expect, it } from "vitest";

import { downloadFilename, formatEpochDate } from "./dates";

describe("formatEpochDate", () => {
	it("formats an epoch-ms timestamp with date-fns", () => {
		expect(formatEpochDate(1786492800000)).toMatch(/^Aug \d{1,2}, 2026$/);
	});

	it("falls back to an em dash for invalid input", () => {
		expect(formatEpochDate(undefined)).toBe("—");
		expect(formatEpochDate(Number.NaN)).toBe("—");
	});
});

describe("downloadFilename", () => {
	it("derives the filename from the last path segment", () => {
		expect(downloadFilename("/images/email/verification.png", "Email Verification")).toBe("verification.png");
	});

	it("falls back to a slugified alt text", () => {
		expect(downloadFilename("/images/email/preview", "Email Verification")).toBe("email-verification.png");
		expect(downloadFilename("", "")).toBe("preview.png");
	});
});
