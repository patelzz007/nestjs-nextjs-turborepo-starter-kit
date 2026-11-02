import { Controller, ForbiddenException, Headers, HttpCode, HttpStatus, Inject, Post, ServiceUnavailableException } from "@nestjs/common";
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
	maskPhone,
} from "@workspace/shared";
import { z } from "zod";

import { TypedConfigService } from "../../../../config/typed-config.service";
import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { Public } from "../../../../platform/presentation/http/security/decorators/public.decorator";
import { PublicOperation } from "../../../../platform/presentation/http/security/decorators/public-operation.decorator";
import { SkipMutationIntent } from "../../../../platform/presentation/http/security/decorators/skip-mutation-intent.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { NOTIFICATION_ACCOUNT, NOTIFICATION_ADMIN } from "../../application/ports/notifications.tokens";
import { NOTIFICATIONS_UNSUBSCRIBE_OPERATION, type NotificationAccountService } from "../../application/services/notification-account.service";
import { NOTIFICATIONS_TWILIO_WEBHOOK_OPERATION, type NotificationAdminService } from "../../application/services/notification-admin.service";
import { destinationHash } from "../../domain/policies/mask-destination";
import { isValidTwilioSignature } from "../../domain/policies/twilio-signature";

const TwilioStatusSchema = z.object({ MessageSid: z.string(), MessageStatus: z.string(), ErrorCode: z.string().optional() });
const TwilioInboundSchema = z.object({ From: z.string(), Body: z.string() });
/** Twilio's standard opt-out keywords (the Messaging Service also blocks the number on its side). */
const STOP_KEYWORDS: readonly string[] = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];
const TWILIO_SIGNATURE_HEADER = "x-twilio-signature";
const RECEIVED: NotificationWebhookReceivedResponse = { received: true };
/** Where Twilio posts (configured in its console, and as each message's status callback). */
export const TWILIO_WEBHOOK_PATH = apiPath("/webhooks/twilio");

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

/** Twilio's signed callbacks (ADR 070): delivery status and inbound SMS (STOP). */
@ApiTags("Notification webhooks")
@Controller(apiPath("/webhooks/twilio"))
export class TwilioWebhooksController {
	public constructor(
		private readonly config: TypedConfigService,
		@Inject(NOTIFICATION_ADMIN) private readonly admin: NotificationAdminService,
	) {}

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
		@Headers(TWILIO_SIGNATURE_HEADER) signature: string | undefined,
		@ZodBody(TwilioCallbackBodySchema) body: z.output<typeof TwilioCallbackBodySchema>,
	): Promise<NotificationWebhookReceivedResponse> {
		const status = TwilioStatusSchema.parse(this.verify("status", signature, body));
		await this.admin.applyTwilioStatus(actor, { messageSid: status.MessageSid, status: status.MessageStatus, errorCode: status.ErrorCode ?? null });
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
		@Headers(TWILIO_SIGNATURE_HEADER) signature: string | undefined,
		@ZodBody(TwilioCallbackBodySchema) body: z.output<typeof TwilioCallbackBodySchema>,
	): Promise<NotificationWebhookReceivedResponse> {
		const message = TwilioInboundSchema.parse(this.verify("inbound", signature, body));
		if (STOP_KEYWORDS.includes(message.Body.trim().toUpperCase())) {
			await this.admin.applyTwilioStop(actor, destinationHash(message.From), maskPhone(message.From));
		}
		return RECEIVED;
	}

	private verify(path: string, signature: string | undefined, params: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
		const twilio = this.config.notifications.twilio;
		if (twilio === null) {
			throw new ServiceUnavailableException("Twilio is not configured on this server");
		}
		if (signature === undefined || !isValidTwilioSignature(twilio.authToken, `${this.config.http.publicUrl}${TWILIO_WEBHOOK_PATH}/${path}`, params, signature)) {
			throw new ForbiddenException("Invalid Twilio signature");
		}
		return params;
	}
}
