import type { RawBodyRequest } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";

import { captureFastifyRequest } from "../../../../../../e2e/support/fastify-request";
import { ActorContextSchema, type ActorContext } from "../../../../../platform/application/actor-context";
import type { InboundWebhookRequest } from "../../../../webhooks/inbound/public-api";
import type { NotificationWebhookReception } from "../../../application/services/notification-webhook-reception";
import { EmailWebhookController } from "../email-webhook.controller";
import { TwilioWebhooksController } from "../notification-webhooks.controller";

/**
 * The provider routes hand the exact bytes and headers they received to the reception (verification, claiming
 * and applying are proved in notification-webhook-reception.spec.ts, the HTTP answers in
 * e2e/email-delivery-webhook.e2e-spec.ts) and answer `{ received: true }`.
 */

const ACTOR: ActorContext = ActorContextSchema.parse({
	kind: "anonymous",
	tenantId: null,
	request: { requestId: "request-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null },
});

type ReceivedCall = readonly [method: string, request: InboundWebhookRequest];

/** Records which reception method each route called, with what. */
class RecordingReception implements Pick<NotificationWebhookReception, "receiveResend" | "receiveTwilioStatus" | "receiveTwilioInbound"> {
	public readonly calls: ReceivedCall[] = [];

	public receiveResend(_actor: ActorContext, request: InboundWebhookRequest): Promise<void> {
		this.calls.push(["resend", request]);
		return Promise.resolve();
	}

	public receiveTwilioStatus(_actor: ActorContext, request: InboundWebhookRequest): Promise<void> {
		this.calls.push(["twilio.status", request]);
		return Promise.resolve();
	}

	public receiveTwilioInbound(_actor: ActorContext, request: InboundWebhookRequest): Promise<void> {
		this.calls.push(["twilio.inbound", request]);
		return Promise.resolve();
	}
}

async function rawRequest(body: string, headers: Readonly<Record<string, string>>): Promise<RawBodyRequest<FastifyRequest>> {
	const request: FastifyRequest = await captureFastifyRequest({ headers: { ...headers }, payload: body });
	return Object.assign(request, { rawBody: Buffer.from(body, "utf8") });
}

describe("the provider webhook routes", () => {
	it("Resend's hands its raw body and headers to the reception and answers received", async () => {
		const reception = new RecordingReception();
		const body = '{"type":"email.delivered"}';

		await expect(new EmailWebhookController(reception).receive(await rawRequest(body, { "webhook-id": "msg_1" }), ACTOR)).resolves.toEqual({ received: true });

		expect(reception.calls.map(([method]): string => method)).toEqual(["resend"]);
		expect(reception.calls.map(([, request]): string => request.rawBody.toString("utf8"))).toEqual([body]);
		expect(reception.calls.map(([, request]): string | undefined => request.headers["webhook-id"])).toEqual(["msg_1"]);
	});

	it("Twilio's status and inbound routes hand theirs to the matching reception method", async () => {
		const reception = new RecordingReception();
		const controller = new TwilioWebhooksController(reception);
		// The capturing server parses JSON only; the route never reads the body itself, so its bytes are what matter.
		const body = '{"MessageSid":"SM1","MessageStatus":"delivered"}';
		const headers = { "x-twilio-signature": "signed" };

		await expect(controller.status(ACTOR, await rawRequest(body, headers), { MessageSid: "SM1" })).resolves.toEqual({ received: true });
		await expect(controller.inbound(ACTOR, await rawRequest(body, headers), { MessageSid: "SM1" })).resolves.toEqual({ received: true });

		expect(reception.calls.map(([method]): string => method)).toEqual(["twilio.status", "twilio.inbound"]);
		expect(reception.calls.map(([, request]): string => request.rawBody.toString("utf8"))).toEqual([body, body]);
	});
});
