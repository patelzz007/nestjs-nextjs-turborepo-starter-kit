import { BadRequestException, ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import { maskPhone } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { inMemoryWebhookReceiver, type InMemoryReceivedWebhookStore } from "../../../../../../e2e/support/in-memory-received-webhooks";
import { signResendWebhook, TEST_RESEND_WEBHOOK_SECRET } from "../../../../../../e2e/support/resend-webhook-signature";
import { ActorContextSchema, type ActorContext } from "../../../../../platform/application/actor-context";
import {
	inboundWebhookRequest,
	StandardWebhooksVerifier,
	TWILIO_SIGNATURE_HEADER,
	twilioSignature,
	TwilioSignatureVerifier,
	type InboundWebhookRequest,
	type WebhookSignatureVerifier,
} from "../../../../webhooks/inbound/public-api";
import type { ApplyEmailDeliveryEventCommand, DeliveryWebhookEvent } from "../../commands/apply-email-delivery-event/apply-email-delivery-event.command";
import type { DeliveryEventRecordResult } from "../../../domain/repositories/email-log.repository";
import { destinationHash } from "../../../domain/policies/mask-destination";
import { EMAIL_LOG_ID_TAG } from "../../../domain/value-objects/email-log-id-tag.value-object";
import type { NotificationWebhookVerifiersPort, TwilioCallbackKind } from "../../ports/notification-webhook-verifiers.port";
import type { NotificationAdminService } from "../notification-admin.service";
import { NotificationWebhookReception, type DeliveryEventDispatch } from "../notification-webhook-reception";

/**
 * Resend's and Twilio's callbacks through the REAL inbound receiver (an in-memory received-webhook log) and the
 * REAL signature schemes, keyed with test-only secrets: nothing about verification or claiming is faked. The
 * command bus and the admin service are recording fakes (their behaviour has its own specs and
 * e2e/email-delivery-webhook.e2e-spec.ts).
 */

const EMAIL_ID = "56715290-9fa9-482a-b098-ba4cc1e1d813";
const EMAIL_LOG_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const OCCURRED_AT = "2026-10-02T10:00:00.000Z";
/** Standard Webhooks' tolerance is 5 minutes; 10 minutes is safely outside it. */
const EXPIRED_SIGNATURE_AGE_MS = 10 * 60 * 1000;
const TWILIO_AUTH_TOKEN = "twilio-test-only-auth-token";
const PUBLIC_URL = "https://api.example.test";
const TWILIO_URLS: Readonly<Record<TwilioCallbackKind, string>> = {
	status: `${PUBLIC_URL}/api/v1/webhooks/twilio/status`,
	inbound: `${PUBLIC_URL}/api/v1/webhooks/twilio/inbound`,
};
const SENDER = "+60123456789";
const ACTOR: ActorContext = ActorContextSchema.parse({
	kind: "anonymous",
	tenantId: null,
	request: { requestId: "request-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null },
});

/** Records every dispatched delivery event and answers with `result`. */
class RecordingBus implements DeliveryEventDispatch {
	public readonly events: DeliveryWebhookEvent[] = [];
	public result: DeliveryEventRecordResult = { kind: "recorded", outcome: "applied", emailLogId: EMAIL_LOG_ID };

	public execute(command: ApplyEmailDeliveryEventCommand): Promise<DeliveryEventRecordResult> {
		this.events.push(command.input);
		return Promise.resolve(this.result);
	}
}

interface TwilioStatusCall {
	readonly messageSid: string;
	readonly status: string;
	readonly errorCode: string | null;
}

interface TwilioStopCall {
	readonly destinationHash: string;
	readonly maskedDestination: string;
}

/** Records the Twilio changes the admin service is asked to make. */
class RecordingAdmin implements Pick<NotificationAdminService, "applyTwilioStatus" | "applyTwilioStop"> {
	public readonly statuses: TwilioStatusCall[] = [];
	public readonly stops: TwilioStopCall[] = [];

	public applyTwilioStatus(_actor: ActorContext, input: TwilioStatusCall): Promise<void> {
		this.statuses.push(input);
		return Promise.resolve();
	}

	public applyTwilioStop(_actor: ActorContext, hash: string, maskedDestination: string): Promise<void> {
		this.stops.push({ destinationHash: hash, maskedDestination });
		return Promise.resolve();
	}
}

/** The verifiers as a deployment with (or without) each provider's key would build them. */
class TestVerifiers implements NotificationWebhookVerifiersPort {
	public constructor(private readonly configured: { readonly resend: boolean; readonly twilio: boolean }) {}

	public resend(): WebhookSignatureVerifier | null {
		return this.configured.resend ? new StandardWebhooksVerifier(TEST_RESEND_WEBHOOK_SECRET, (): number => Date.now()) : null;
	}

	public twilio(kind: TwilioCallbackKind): WebhookSignatureVerifier | null {
		return this.configured.twilio ? new TwilioSignatureVerifier(TWILIO_AUTH_TOKEN, TWILIO_URLS[kind]) : null;
	}
}

interface Harness {
	readonly reception: NotificationWebhookReception;
	readonly bus: RecordingBus;
	readonly admin: RecordingAdmin;
	readonly log: InMemoryReceivedWebhookStore;
}

function harness(configured: { readonly resend: boolean; readonly twilio: boolean } = { resend: true, twilio: true }): Harness {
	const bus = new RecordingBus();
	const admin = new RecordingAdmin();
	const { receiver, store } = inMemoryWebhookReceiver();
	return { reception: new NotificationWebhookReception(new TestVerifiers(configured), bus, admin, receiver), bus, admin, log: store };
}

function resendEvent(type: string, data: Readonly<Record<string, string | object>> = {}): string {
	return JSON.stringify({ type, created_at: OCCURRED_AT, data: { email_id: EMAIL_ID, ...data } });
}

function postResend(reception: NotificationWebhookReception, body: string, headers: Readonly<Record<string, string>>): Promise<void> {
	return reception.receiveResend(ACTOR, inboundWebhookRequest(Buffer.from(body, "utf8"), headers));
}

/** A Twilio form post, signed for `kind`'s URL (or not signed at all). */
function twilioRequest(
	kind: TwilioCallbackKind,
	fields: Readonly<Record<string, string>>,
	options: { readonly signed?: boolean; readonly token?: string } = {},
): InboundWebhookRequest {
	const signature = twilioSignature(options.token ?? TWILIO_AUTH_TOKEN, TWILIO_URLS[kind], fields);
	const headers = options.signed === false ? {} : { [TWILIO_SIGNATURE_HEADER]: signature };
	return inboundWebhookRequest(Buffer.from(new URLSearchParams(fields).toString(), "utf8"), { "content-type": "application/x-www-form-urlencoded", ...headers });
}

describe("NotificationWebhookReception: Resend", () => {
	it("applies a correctly signed event with its webhook id, provider time and email_log_id tag, and logs it as RECORDED", async () => {
		const { reception, bus, log } = harness();
		const body = resendEvent("email.delivered", { tags: { [EMAIL_LOG_ID_TAG]: EMAIL_LOG_ID } });

		await postResend(reception, body, signResendWebhook(body, { webhookId: "msg_1" }));

		expect(bus.events).toEqual([
			{
				webhookId: "msg_1",
				eventType: "email.delivered",
				resendId: EMAIL_ID,
				taggedEmailLogId: EMAIL_LOG_ID,
				status: "delivered",
				detail: undefined,
				occurredAt: Date.parse(OCCURRED_AT),
			},
		]);
		expect(log.rows).toEqual([
			expect.objectContaining({ provider: "RESEND", providerDeliveryId: "msg_1", eventType: "email.delivered", outcome: "RECORDED", httpStatus: 200 }),
		]);
	});

	it("accepts the svix-* header names Resend may use", async () => {
		const { reception, bus } = harness();
		const body = resendEvent("email.sent");
		const signed = signResendWebhook(body, { webhookId: "msg_svix" });
		const headers = Object.fromEntries(Object.entries(signed).map(([name, value]): [string, string] => [name.replace(/^webhook-/u, "svix-"), value]));

		await postResend(reception, body, headers);

		expect(bus.events).toEqual([expect.objectContaining({ webhookId: "msg_svix", status: "sent" })]);
	});

	it("answers a redelivered webhook id without applying it again", async () => {
		const { reception, bus, log } = harness();
		const body = resendEvent("email.delivered");
		const headers = signResendWebhook(body, { webhookId: "msg_9" });

		await postResend(reception, body, headers);
		await postResend(reception, body, headers);

		expect(bus.events).toHaveLength(1);
		expect(log.rows).toEqual([expect.objectContaining({ providerDeliveryId: "msg_9", outcome: "RECORDED", duplicateCount: 1 })]);
	});

	it("logs an event the email log already had as DUPLICATE", async () => {
		const { reception, bus, log } = harness();
		bus.result = { kind: "duplicate" };
		const body = resendEvent("email.delivered");

		await postResend(reception, body, signResendWebhook(body, { webhookId: "msg_10" }));

		expect(log.rows).toEqual([expect.objectContaining({ outcome: "DUPLICATE" })]);
	});

	it("refuses (403) a tampered body: the signature covers the raw bytes", async () => {
		const { reception, bus, log } = harness();
		const headers = signResendWebhook(resendEvent("email.delivered"), { webhookId: "msg_2" });

		await expect(postResend(reception, resendEvent("email.bounced"), headers)).rejects.toThrow(/Invalid webhook signature \(No matching signature found\)/u);
		expect(bus.events).toEqual([]);
		expect(log.rows).toEqual([expect.objectContaining({ provider: "RESEND", verification: "INVALID", outcome: "REJECTED" })]);
	});

	it("refuses (403) a payload signed with a different secret", async () => {
		const { reception, bus } = harness();
		const body = resendEvent("email.delivered");

		await expect(postResend(reception, body, signResendWebhook(body, { webhookId: "msg_3", secret: "whsec_YW5vdGhlci1zZWNyZXQtYWx0b2dldGhlcg==" }))).rejects.toBeInstanceOf(
			ForbiddenException,
		);
		expect(bus.events).toEqual([]);
	});

	it("refuses (403) a replay whose signature timestamp is outside the tolerance, saying it expired", async () => {
		const { reception, bus } = harness();
		const body = resendEvent("email.delivered");

		await expect(postResend(reception, body, signResendWebhook(body, { webhookId: "msg_4", signedAtMs: Date.now() - EXPIRED_SIGNATURE_AGE_MS }))).rejects.toThrow(
			/too old.*outside the 5-minute window/u,
		);
		expect(bus.events).toEqual([]);
	});

	it("refuses (403) a request without signature headers, naming each missing one", async () => {
		const { reception, bus, log } = harness();

		await expect(postResend(reception, resendEvent("email.delivered"), { "content-type": "application/json" })).rejects.toThrow(
			"Missing webhook signature header(s): webhook-id/svix-id, webhook-timestamp/svix-timestamp, webhook-signature/svix-signature.",
		);
		expect(bus.events).toEqual([]);
		expect(log.rows).toEqual([expect.objectContaining({ verification: "MISSING", outcome: "REJECTED" })]);
	});

	it("answers 503 (so Resend retries) and applies nothing when RESEND_WEBHOOK_SECRET is not configured", async () => {
		const { reception, bus, log } = harness({ resend: false, twilio: true });
		const body = resendEvent("email.bounced");

		await expect(postResend(reception, body, signResendWebhook(body, { webhookId: "msg_5" }))).rejects.toBeInstanceOf(ServiceUnavailableException);
		expect(bus.events).toEqual([]);
		expect(log.rows).toEqual([expect.objectContaining({ verification: "NOT_CONFIGURED", httpStatus: 503 })]);
	});

	it("refuses (400) a correctly signed payload that is not a Resend event, instead of acknowledging it", async () => {
		const { reception, bus, log } = harness();
		const body = JSON.stringify({ type: "email.delivered", data: { email_id: EMAIL_ID } });

		await expect(postResend(reception, body, signResendWebhook(body, { webhookId: "msg_6" }))).rejects.toBeInstanceOf(BadRequestException);
		expect(bus.events).toEqual([]);
		expect(log.rows).toEqual([expect.objectContaining({ outcome: "REJECTED", httpStatus: 400 })]);
	});

	it("captures the bounce reason as the row detail", async () => {
		const { reception, bus } = harness();
		const body = resendEvent("email.bounced", { bounce: { bounce_type: "permanent", message: "550 5.1.1 user unknown" } });

		await postResend(reception, body, signResendWebhook(body, { webhookId: "msg_7" }));

		expect(bus.events).toEqual([expect.objectContaining({ status: "bounced", detail: "permanent — 550 5.1.1 user unknown" })]);
	});

	it("records tracking events with no status (they never change the row)", async () => {
		const { reception, bus } = harness();
		const body = resendEvent("email.opened");

		await postResend(reception, body, signResendWebhook(body, { webhookId: "msg_8" }));

		expect(bus.events).toEqual([expect.objectContaining({ eventType: "email.opened", status: undefined })]);
	});

	it("ignores a malformed email_log_id tag and falls back to matching by provider id", async () => {
		const { reception, bus } = harness();
		const body = resendEvent("email.delivered", { tags: { [EMAIL_LOG_ID_TAG]: "not-a-uuid" } });

		await postResend(reception, body, signResendWebhook(body, { webhookId: "msg_11" }));

		expect(bus.events).toEqual([expect.objectContaining({ taggedEmailLogId: undefined, resendId: EMAIL_ID })]);
	});
});

describe("NotificationWebhookReception: Twilio", () => {
	it("applies a signed delivery status once, and answers its redelivery without applying it again", async () => {
		const { reception, admin, log } = harness();
		const request = twilioRequest("status", { MessageSid: "SM1", MessageStatus: "undelivered", ErrorCode: "30005" });

		await reception.receiveTwilioStatus(ACTOR, request);
		await reception.receiveTwilioStatus(ACTOR, request);

		expect(admin.statuses).toEqual([{ messageSid: "SM1", status: "undelivered", errorCode: "30005" }]);
		expect(log.rows).toEqual([
			expect.objectContaining({ provider: "TWILIO", providerDeliveryId: "status:SM1:undelivered", eventType: "status.undelivered", outcome: "RECORDED", duplicateCount: 1 }),
		]);
	});

	it("refuses (403) a status signed for another URL or with another token, or not signed", async () => {
		const { reception, admin } = harness();
		const fields = { MessageSid: "SM2", MessageStatus: "delivered" };

		await expect(reception.receiveTwilioStatus(ACTOR, twilioRequest("inbound", fields))).rejects.toBeInstanceOf(ForbiddenException);
		await expect(reception.receiveTwilioStatus(ACTOR, twilioRequest("status", fields, { token: "another-token" }))).rejects.toBeInstanceOf(ForbiddenException);
		await expect(reception.receiveTwilioStatus(ACTOR, twilioRequest("status", fields, { signed: false }))).rejects.toThrow("Invalid Twilio signature");
		expect(admin.statuses).toEqual([]);
	});

	it("refuses (400) a signed status callback without its fields", async () => {
		const { reception, admin, log } = harness();

		await expect(reception.receiveTwilioStatus(ACTOR, twilioRequest("status", { MessageSid: "SM3" }))).rejects.toBeInstanceOf(BadRequestException);
		expect(admin.statuses).toEqual([]);
		expect(log.rows).toEqual([expect.objectContaining({ outcome: "REJECTED", httpStatus: 400 })]);
	});

	it("answers 503 (so Twilio retries) when Twilio is not configured", async () => {
		const { reception, admin } = harness({ resend: true, twilio: false });

		await expect(reception.receiveTwilioStatus(ACTOR, twilioRequest("status", { MessageSid: "SM4", MessageStatus: "delivered" }))).rejects.toBeInstanceOf(
			ServiceUnavailableException,
		);
		await expect(reception.receiveTwilioInbound(ACTOR, twilioRequest("inbound", { MessageSid: "SM5", From: SENDER, Body: "STOP" }))).rejects.toBeInstanceOf(
			ServiceUnavailableException,
		);
		expect(admin.statuses).toEqual([]);
		expect(admin.stops).toEqual([]);
	});

	it("suppresses a number that texts an opt-out keyword, whatever its case and spacing", async () => {
		const { reception, admin, log } = harness();

		await reception.receiveTwilioInbound(ACTOR, twilioRequest("inbound", { MessageSid: "SM6", From: SENDER, Body: "  stop " }));

		expect(admin.stops.map((stop: TwilioStopCall): string => stop.destinationHash)).toEqual([destinationHash(SENDER)]);
		expect(admin.stops.map((stop: TwilioStopCall): string => stop.maskedDestination)).toEqual([maskPhone(SENDER)]);
		expect(log.rows).toEqual([expect.objectContaining({ providerDeliveryId: "inbound:SM6", outcome: "RECORDED" })]);
	});

	it("records any other inbound message as IGNORED, suppressing nothing", async () => {
		const { reception, admin, log } = harness();

		await reception.receiveTwilioInbound(ACTOR, twilioRequest("inbound", { MessageSid: "SM7", From: SENDER, Body: "hello" }));

		expect(admin.stops).toEqual([]);
		expect(log.rows).toEqual([expect.objectContaining({ outcome: "IGNORED" })]);
	});

	it("refuses (403) an inbound message signed for the status URL", async () => {
		const { reception, admin } = harness();

		await expect(reception.receiveTwilioInbound(ACTOR, twilioRequest("status", { MessageSid: "SM8", From: SENDER, Body: "STOP" }))).rejects.toBeInstanceOf(ForbiddenException);
		expect(admin.stops).toEqual([]);
	});
});
