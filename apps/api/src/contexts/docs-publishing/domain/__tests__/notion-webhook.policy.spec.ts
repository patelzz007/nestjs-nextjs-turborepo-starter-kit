import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { NOTION_WEBHOOK_PROFILE, inboundWebhookRequest } from "../../../webhooks/inbound/public-api";
import { handshakeTokenOf, notionSignatureVerifier, warrantsSync } from "../notion-webhook.policy";

const SECRET = "secret_verification_token";

function signed(body: string, secret: string = SECRET): ReturnType<typeof inboundWebhookRequest> {
	const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
	return inboundWebhookRequest(Buffer.from(body), { "x-notion-signature": signature });
}

describe("notionSignatureVerifier", () => {
	it("accepts what Notion signed", () => {
		expect(notionSignatureVerifier(SECRET).verify(signed("{}")).verdict).toBe("VALID");
	});

	it("refuses another key, and a body that changed", () => {
		const request = signed("{}");

		expect(notionSignatureVerifier(SECRET).verify(signed("{}", "other")).verdict).toBe("INVALID");
		expect(notionSignatureVerifier(SECRET).verify({ ...request, rawBody: Buffer.from('{"a":1}') }).verdict).toBe("INVALID");
	});

	it("refuses a request with no signature", () => {
		expect(notionSignatureVerifier(SECRET).verify(inboundWebhookRequest(Buffer.from("{}"), {})).verdict).toBe("MISSING");
	});
});

describe("handshakeTokenOf", () => {
	it("reads the token from Notion's first request", () => {
		expect(handshakeTokenOf(inboundWebhookRequest(Buffer.from('{"verification_token":"secret_abc"}'), {}))).toBe("secret_abc");
	});

	it.each(["not json", "{}", '{"verification_token":""}', '{"verification_token":"a","extra":1}', `{"verification_token":"${"x".repeat(501)}"}`])("refuses %s", (body) => {
		expect(handshakeTokenOf(inboundWebhookRequest(Buffer.from(body), {}))).toBeNull();
	});

	it("reads the token when Notion also signs the handshake, as the live service does", () => {
		expect(handshakeTokenOf(signed('{"verification_token":"secret_abc"}', "a key this server does not have"))).toBe("secret_abc");
	});

	it("never reads an event as the handshake, signed or not", () => {
		expect(handshakeTokenOf(signed('{"id":"event-1","type":"page.created"}'))).toBeNull();
	});
});

describe("warrantsSync", () => {
	it.each([
		"page.content_updated",
		"page.properties_updated",
		"page.created",
		"page.deleted",
		"page.moved",
		"page.undeleted",
		"data_source.content_updated",
		"database.moved",
	])("syncs on %s", (event) => {
		expect(warrantsSync(event)).toBe(true);
	});

	it.each(["page.locked", "page.unlocked", "comment.created", "something.new"])("ignores %s", (event) => {
		expect(warrantsSync(event)).toBe(false);
	});

	it("ignores an event with no name", () => {
		expect(warrantsSync(null)).toBe(false);
	});
});

describe("NOTION_WEBHOOK_PROFILE", () => {
	it("identifies a delivery by the event's id, which a retry repeats", () => {
		const envelope = NOTION_WEBHOOK_PROFILE.envelopeOf(inboundWebhookRequest(Buffer.from('{"id":"event-1","type":"page.created","attempt_number":2}'), {}));

		expect(envelope).toEqual({ deliveryId: "event-1", eventType: "page.created" });
	});

	it("reads nothing from a body that is not an event", () => {
		expect(NOTION_WEBHOOK_PROFILE.envelopeOf(inboundWebhookRequest(Buffer.from("{}"), {}))).toEqual({ deliveryId: null, eventType: null });
	});
});
