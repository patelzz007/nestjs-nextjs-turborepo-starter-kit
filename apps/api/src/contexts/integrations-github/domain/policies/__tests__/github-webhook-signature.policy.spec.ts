import { describe, expect, it } from "vitest";

import { githubSignatureVerifier, githubWebhookSignature } from "../github-webhook-signature.policy";

const SECRET = "It's a Secret to Everybody";
const BODY = Buffer.from("Hello, World!");

/** The verdict GitHub's verifier gives `rawBody` signed with `header`. */
function verdictOf(secret: string, rawBody: Buffer, header: string | undefined): string {
	return githubSignatureVerifier(secret).verify({ rawBody, headers: { "x-hub-signature-256": header } }).verdict;
}

describe("GitHub webhook signatures", () => {
	it("matches GitHub's documented example", () => {
		// docs.github.com — "Validating webhook deliveries", test values.
		expect(githubWebhookSignature(SECRET, BODY)).toBe("sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17");
	});

	it("accepts GitHub's signature of exactly these bytes", () => {
		expect(verdictOf(SECRET, BODY, githubWebhookSignature(SECRET, BODY))).toBe("VALID");
		expect(verdictOf(SECRET, BODY, githubWebhookSignature(SECRET, BODY).toUpperCase().replace("SHA256=", "sha256="))).toBe("VALID");
	});

	it("refuses another body, another secret, a missing, malformed or truncated header", () => {
		const signature = githubWebhookSignature(SECRET, BODY);

		expect(verdictOf(SECRET, Buffer.from("Hello, World?"), signature)).toBe("INVALID");
		expect(verdictOf("another secret", BODY, signature)).toBe("INVALID");
		expect(verdictOf(SECRET, BODY, undefined)).toBe("MISSING");
		expect(verdictOf(SECRET, BODY, signature.replace("sha256=", "sha1="))).toBe("INVALID");
		expect(verdictOf(SECRET, BODY, signature.slice(0, -2))).toBe("INVALID");
		expect(verdictOf(SECRET, BODY, `sha256=${"z".repeat(64)}`)).toBe("INVALID");
	});
});
