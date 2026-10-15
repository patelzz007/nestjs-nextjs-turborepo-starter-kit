import { describe, expect, it } from "vitest";

import { githubWebhookSignature, isValidGithubWebhookSignature } from "./github-webhook-signature";

const SECRET = "It's a Secret to Everybody";
const BODY = Buffer.from("Hello, World!");

describe("GitHub webhook signatures", () => {
	it("matches GitHub's documented example", () => {
		// docs.github.com — "Validating webhook deliveries", test values.
		expect(githubWebhookSignature(SECRET, BODY)).toBe("sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17");
	});

	it("accepts GitHub's signature of exactly these bytes", () => {
		expect(isValidGithubWebhookSignature(SECRET, BODY, githubWebhookSignature(SECRET, BODY))).toBe(true);
		expect(isValidGithubWebhookSignature(SECRET, BODY, githubWebhookSignature(SECRET, BODY).toUpperCase().replace("SHA256=", "sha256="))).toBe(true);
	});

	it("refuses another body, another secret, a missing, malformed or truncated header", () => {
		const signature = githubWebhookSignature(SECRET, BODY);

		expect(isValidGithubWebhookSignature(SECRET, Buffer.from("Hello, World?"), signature)).toBe(false);
		expect(isValidGithubWebhookSignature("another secret", BODY, signature)).toBe(false);
		expect(isValidGithubWebhookSignature(SECRET, BODY, undefined)).toBe(false);
		expect(isValidGithubWebhookSignature(SECRET, BODY, signature.replace("sha256=", "sha1="))).toBe(false);
		expect(isValidGithubWebhookSignature(SECRET, BODY, signature.slice(0, -2))).toBe(false);
		expect(isValidGithubWebhookSignature(SECRET, BODY, `sha256=${"z".repeat(64)}`)).toBe(false);
	});
});
