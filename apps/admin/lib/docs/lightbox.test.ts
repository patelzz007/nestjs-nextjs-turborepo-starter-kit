import { describe, expect, it } from "vitest";

import { downloadFilename } from "@/lib/docs/lightbox";

describe("downloadFilename", () => {
	it("uses the last URL path segment when it carries an extension", (): void => {
		expect(downloadFilename("/docs/images/email/verification.png", "Email Verification")).toBe("verification.png");
	});

	it("falls back to a slugified alt when the path has no file segment", (): void => {
		expect(downloadFilename("/docs/images", "Password Reset")).toBe("password-reset.png");
	});

	it("falls back to preview.png when neither src nor alt yields a name", (): void => {
		expect(downloadFilename("/docs/images", "   ")).toBe("preview.png");
		expect(downloadFilename("", "")).toBe("preview.png");
	});

	it("strips query strings and trailing slashes from the src", (): void => {
		expect(downloadFilename("https://cdn.example.com/assets/welcome.png?w=800", "Welcome")).toBe("welcome.png");
		expect(downloadFilename("/docs/images/email/admin-alert.png#x", "Admin Alert")).toBe("admin-alert.png");
	});

	it("slugifies mixed-case alt text to lowercase kebab", (): void => {
		expect(downloadFilename("", "API Key Created!")).toBe("api-key-created.png");
	});
});
