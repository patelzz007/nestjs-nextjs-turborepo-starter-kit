import { Controller, HttpCode, HttpStatus, Inject, Post, Req } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	NotificationWebhookReceivedResponseSchema,
	OneClickUnsubscribeBodySchema,
	TwilioCallbackBodySchema,
	UnsubscribeBodySchema,
	UnsubscribeQuerySchema,
	UnsubscribeResponseSchema,
	type NotificationWebhookReceivedResponse,
	type UnsubscribeBody,
	type UnsubscribeResponse,
} from "@workspace/shared";
import type { FastifyRequest } from "fastify";
import { z } from "zod";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { Public } from "../../../../platform/presentation/http/security/decorators/public.decorator";
import { PublicOperation } from "../../../../platform/presentation/http/security/decorators/public-operation.decorator";
import { SkipMutationIntent } from "../../../../platform/presentation/http/security/decorators/skip-mutation-intent.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { inboundWebhookRequest, TWILIO_SIGNATURE_HEADER } from "../../../webhooks/inbound/public-api";
import { NOTIFICATION_ACCOUNT, NOTIFICATION_WEBHOOK_RECEPTION } from "../../application/ports/notifications.tokens";
import { NOTIFICATIONS_UNSUBSCRIBE_OPERATION, type NotificationAccountService } from "../../application/services/notification-account.service";
import { NOTIFICATIONS_TWILIO_WEBHOOK_OPERATION } from "../../application/services/notification-admin.service";
import type { NotificationWebhookReception } from "../../application/services/notification-webhook-reception";

const RECEIVED: NotificationWebhookReceivedResponse = { received: true };
/** Session-less unsubscribe (ADR 070): the web page's call and RFC 8058 one-click, both with a signed token. */
@ApiTags("Notification webhooks")
@Controller(apiPath("/notifications"))
export class NotificationUnsubscribeController {
	public constructor(@Inject(NOTIFICATION_ACCOUNT) private readonly account: NotificationAccountService) {}

	/** The web unsubscribe page posts the token from its own URL. */
	@Public()
	@PublicOperation(NOTIFICATIONS_UNSUBSCRIBE_OPERATION)
	@RateLimit(RATE_LIMIT_POLICY.webhook)
	@Post("unsubscribe")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Unsubscribe with a signed link's token (the web page); 400 for an invalid link" })
	@ZodResponse(UnsubscribeResponseSchema, { description: "What was unsubscribed" })
	public unsubscribe(@CurrentActor() actor: ActorContext, @ZodBody(UnsubscribeBodySchema) body: UnsubscribeBody): Promise<UnsubscribeResponse> {
		return this.account.applyUnsubscribe(actor, body.token);
	}

	/** RFC 8058: the mail client POSTs `List-Unsubscribe=One-Click` to the header's URL, which carries the token. */
	@Public()
	@PublicOperation(NOTIFICATIONS_UNSUBSCRIBE_OPERATION)
	@SkipMutationIntent()
	@RateLimit(RATE_LIMIT_POLICY.webhook)
	@Post("unsubscribe/one-click")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "One-click unsubscribe (RFC 8058, from the List-Unsubscribe header); 400 for an invalid link" })
	@ZodResponse(UnsubscribeResponseSchema, { description: "What was unsubscribed" })
	public oneClickUnsubscribe(
		@CurrentActor() actor: ActorContext,
		@ZodQuery(UnsubscribeQuerySchema) query: z.output<typeof UnsubscribeQuerySchema>,
		@ZodBody(OneClickUnsubscribeBodySchema) _body: z.output<typeof OneClickUnsubscribeBodySchema>,
	): Promise<UnsubscribeResponse> {
		return this.account.applyUnsubscribe(actor, query.token);
	}
}

/**
 * Twilio's signed callbacks (ADR 070): delivery status and inbound SMS (STOP), through the shared inbound
 * receiver (ADR 081): checked against the URL and form fields, each delivery applied once, every request logged.
 * The OpenAPI body is the form as Twilio posts it; what is signed, and read, is the raw body.
 */
@ApiTags("Notification webhooks")
@Controller(apiPath("/webhooks/twilio"))
export class TwilioWebhooksController {
	public constructor(@Inject(NOTIFICATION_WEBHOOK_RECEPTION) private readonly reception: Pick<NotificationWebhookReception, "receiveTwilioStatus" | "receiveTwilioInbound">) {}

	@Public()
	@PublicOperation(NOTIFICATIONS_TWILIO_WEBHOOK_OPERATION)
	@SkipMutationIntent()
	@RateLimit(RATE_LIMIT_POLICY.webhook)
	@Post("status")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Twilio delivery status callback (signature-verified); 403 for a bad signature, 503 when Twilio is not configured" })
	@ApiHeader({ name: TWILIO_SIGNATURE_HEADER, required: true, description: "Twilio's HMAC-SHA1 of the URL and the sorted form fields" })
	@ZodResponse(NotificationWebhookReceivedResponseSchema, { description: "Recorded" })
	public async status(
		@CurrentActor() actor: ActorContext,
		@Req() request: RawBodyRequest<FastifyRequest>,
		@ZodBody(TwilioCallbackBodySchema) _body: z.output<typeof TwilioCallbackBodySchema>,
	): Promise<NotificationWebhookReceivedResponse> {
		await this.reception.receiveTwilioStatus(actor, inboundWebhookRequest(request.rawBody, request.headers));
		return RECEIVED;
	}

	@Public()
	@PublicOperation(NOTIFICATIONS_TWILIO_WEBHOOK_OPERATION)
	@SkipMutationIntent()
	@RateLimit(RATE_LIMIT_POLICY.webhook)
	@Post("inbound")
	@HttpCode(HttpStatus.OK)
	@ApiOperation({ summary: "Inbound SMS (signature-verified): STOP suppresses the number; 403 for a bad signature, 503 when Twilio is not configured" })
	@ApiHeader({ name: TWILIO_SIGNATURE_HEADER, required: true, description: "Twilio's HMAC-SHA1 of the URL and the sorted form fields" })
	@ZodResponse(NotificationWebhookReceivedResponseSchema, { description: "Handled" })
	public async inbound(
		@CurrentActor() actor: ActorContext,
		@Req() request: RawBodyRequest<FastifyRequest>,
		@ZodBody(TwilioCallbackBodySchema) _body: z.output<typeof TwilioCallbackBodySchema>,
	): Promise<NotificationWebhookReceivedResponse> {
		await this.reception.receiveTwilioInbound(actor, inboundWebhookRequest(request.rawBody, request.headers));
		return RECEIVED;
	}
}
