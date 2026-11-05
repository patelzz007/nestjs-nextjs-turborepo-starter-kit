import { epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { signResendWebhook, TEST_RESEND_WEBHOOK_SECRET } from "../../../../../../test/support/resend-webhook-signature";
import { createTestTypedConfig } from "../../../../../../test/support/test-api-env";
import type { Clock } from "../../../../../platform/application/clock.port";
import { inboundWebhookRequest, TWILIO_SIGNATURE_HEADER, twilioSignature, type InboundWebhookRequest } from "../../../../webhooks/inbound/public-api";
import { ConfiguredNotificationWebhookVerifiers } from "../notification-webhook-verifiers.adapter";

const PUBLIC_URL = "https://api.example.test";
const TWILIO_ENV = { TWILIO_ACCOUNT_SID: "AC-test", TWILIO_AUTH_TOKEN: "twilio-test-only-auth-token", TWILIO_MESSAGING_SERVICE_SID: "MG-test" };
const FIELDS = { MessageSid: "SM1", MessageStatus: "delivered" };
/** Standard Webhooks' tolerance is 5 minutes; 10 minutes is safely outside it. */
const EXPIRED_SIGNATURE_AGE_MS = 10 * 60 * 1000;

/** A clock fixed at the moment the test signs at. */
class FixedClock implements Clock {
	public constructor(private readonly nowMs: number) {}

	public now(): ReturnType<Clock["now"]> {
		return epochMs(this.nowMs);
	}
}

function verifiers(env: Readonly<Record<string, string | undefined>>, nowMs: number = Date.now()): ConfiguredNotificationWebhookVerifiers {
	return new ConfiguredNotificationWebhookVerifiers(createTestTypedConfig({ API_PUBLIC_URL: PUBLIC_URL, ...env }), new FixedClock(nowMs));
}

function twilioPost(url: string): InboundWebhookRequest {
	return inboundWebhookRequest(Buffer.from(new URLSearchParams(FIELDS).toString(), "utf8"), {
		[TWILIO_SIGNATURE_HEADER]: twilioSignature(TWILIO_ENV.TWILIO_AUTH_TOKEN, url, FIELDS),
	});
}

describe("ConfiguredNotificationWebhookVerifiers", () => {
	it("has no Resend verifier without RESEND_WEBHOOK_SECRET, and one keyed by it (on the config's clock) with it", () => {
		const body = '{"type":"email.sent"}';
		const signedAtMs = Date.now();
		const request = inboundWebhookRequest(Buffer.from(body, "utf8"), signResendWebhook(body, { webhookId: "msg_1", signedAtMs }));

		expect(verifiers({ RESEND_WEBHOOK_SECRET: undefined }).resend()).toBeNull();
		expect(verifiers({ RESEND_WEBHOOK_SECRET: TEST_RESEND_WEBHOOK_SECRET }, signedAtMs).resend()?.verify(request)).toEqual({ verdict: "VALID" });
		expect(
			verifiers({ RESEND_WEBHOOK_SECRET: TEST_RESEND_WEBHOOK_SECRET }, signedAtMs + EXPIRED_SIGNATURE_AGE_MS)
				.resend()
				?.verify(request),
		).toEqual({
			verdict: "INVALID",
			reason: "Message timestamp too old",
		});
	});

	it("has no Twilio verifier without Twilio's settings", () => {
		expect(verifiers({ TWILIO_ACCOUNT_SID: undefined, TWILIO_AUTH_TOKEN: undefined, TWILIO_MESSAGING_SERVICE_SID: undefined }).twilio("status")).toBeNull();
	});

	it("keys each Twilio callback with this server's public URL of that route", () => {
		const configured = verifiers(TWILIO_ENV);
		const statusUrl = `${PUBLIC_URL}/api/v1/webhooks/twilio/status`;
		const inboundUrl = `${PUBLIC_URL}/api/v1/webhooks/twilio/inbound`;

		expect(configured.twilio("status")?.verify(twilioPost(statusUrl))).toEqual({ verdict: "VALID" });
		expect(configured.twilio("inbound")?.verify(twilioPost(inboundUrl))).toEqual({ verdict: "VALID" });
		expect(configured.twilio("inbound")?.verify(twilioPost(statusUrl))).toEqual(expect.objectContaining({ verdict: "INVALID" }));
	});
});
