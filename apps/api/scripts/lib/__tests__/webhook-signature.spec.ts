import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { signStandardWebhook, standardWebhookHeaders } from "../webhook-signature";

const KEY = Buffer.from("starter-kit-test-signing-key");
const SECRET = `whsec_${KEY.toString("base64")}`;
const TIMESTAMP_SECONDS = 1_792_368_000;

describe("signStandardWebhook", () => {
	it("signs <id>.<timestamp>.<payload> with the decoded secret, as standard-webhooks verifiers expect", () => {
		const payload = '{"type":"email.delivered"}';
		const expected = createHmac("sha256", KEY)
			.update(`msg_1.${String(TIMESTAMP_SECONDS)}.${payload}`)
			.digest("base64");

		expect(signStandardWebhook(SECRET, "msg_1", TIMESTAMP_SECONDS, payload)).toEqual({ id: "msg_1", timestamp: String(TIMESTAMP_SECONDS), signature: `v1,${expected}` });
	});

	it("gives a different signature to a tampered payload", () => {
		const signed = signStandardWebhook(SECRET, "msg_1", TIMESTAMP_SECONDS, "a");

		expect(signStandardWebhook(SECRET, "msg_1", TIMESTAMP_SECONDS, "b").signature).not.toBe(signed.signature);
	});

	it("carries the signature in the three standard-webhooks headers", () => {
		const signed = signStandardWebhook(SECRET, "msg_1", TIMESTAMP_SECONDS, "a");

		expect([...standardWebhookHeaders(signed)]).toEqual([
			["webhook-id", "msg_1"],
			["webhook-timestamp", String(TIMESTAMP_SECONDS)],
			["webhook-signature", signed.signature],
		]);
	});

	it("refuses a secret that is not a whsec_ signing secret", () => {
		expect(() => signStandardWebhook("", "msg_1", TIMESTAMP_SECONDS, "a")).toThrow("RESEND_WEBHOOK_SECRET");
		expect(() => signStandardWebhook("re_api_key", "msg_1", TIMESTAMP_SECONDS, "a")).toThrow("whsec_");
	});
});
