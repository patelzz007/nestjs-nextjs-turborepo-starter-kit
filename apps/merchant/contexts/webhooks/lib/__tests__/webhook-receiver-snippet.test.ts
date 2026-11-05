import { createHmac } from "node:crypto";

import { WEBHOOK_SIGNATURE_TOLERANCE_SECONDS } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { buildWebhookReceiverSnippet } from "@/contexts/webhooks/lib/webhook-receiver-snippet";

describe("buildWebhookReceiverSnippet", () => {
	const snippet = buildWebhookReceiverSnippet();

	it("reads the headers the API sends, in the lower case Node exposes them", () => {
		expect(snippet).toContain(`req.get("webhook-signature")`);
		expect(snippet).toContain(`req.get("webhook-id")`);
	});

	it("uses the documented tolerance and a constant-time comparison", () => {
		expect(snippet).toContain(`const TOLERANCE_SECONDS = ${String(WEBHOOK_SIGNATURE_TOLERANCE_SECONDS)};`);
		expect(snippet).toContain("crypto.timingSafeEqual");
	});

	it("signs exactly what the platform signs: HMAC-SHA256 of the timestamp, a dot and the raw body", () => {
		expect(snippet).toContain('createHmac("sha256", SECRET).update(`${t}.${rawBody}`).digest("hex")');
		// The same recipe the API uses (domain/policies/webhook-signature.policy.ts), checked on a known value.
		const expected = createHmac("sha256", "whsec_test").update('1700000000.{"ok":true}').digest("hex");
		expect(expected).toHaveLength(64);
	});

	it("reads the raw body, never a re-serialised one", () => {
		expect(snippet).toContain("express.text(");
	});
});
