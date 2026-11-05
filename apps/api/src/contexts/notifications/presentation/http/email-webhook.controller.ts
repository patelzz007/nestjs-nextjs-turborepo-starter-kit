import { Controller, Get, Inject, Post, Req } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import { ApiBody, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";

import { EmailWebhookInfoResponseSchema, EmailWebhookReceivedResponseSchema, type EmailWebhookInfoResponse, type EmailWebhookReceivedResponse } from "@workspace/shared";

import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { Public } from "../../../../platform/presentation/http/security/decorators/public.decorator";
import { PublicOperation } from "../../../../platform/presentation/http/security/decorators/public-operation.decorator";
import { SkipMutationIntent } from "../../../../platform/presentation/http/security/decorators/skip-mutation-intent.decorator";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { inboundWebhookRequest } from "../../../webhooks/inbound/public-api";
import { EMAIL_LOG_WRITE_OPERATION } from "../../application/notifications-scope";
import { NOTIFICATION_WEBHOOK_RECEPTION } from "../../application/ports/notifications.tokens";
import type { NotificationWebhookReception } from "../../application/services/notification-webhook-reception";
import { ResendWebhookEventDto } from "./dtos/resend-webhook-event.dto";

const RECEIVED: EmailWebhookReceivedResponse = { received: true };

/**
 * Receives Resend's delivery webhooks and updates the matching `EmailLog` row, through the shared inbound
 * receiver (ADR 081): the signature (Standard Webhooks, `RESEND_WEBHOOK_SECRET`) is checked over the raw body,
 * each `webhook-id` is applied once, and every request lands in the received-webhook log.
 *
 * - Delivery events (`email.delivered` / `email.bounced` / `email.complained` / `email.failed`) move the row's
 *   status; bounce and complaint reasons become its `error`, so the admin sees WHY it bounced.
 * - Tracking events (`email.opened` / `email.clicked`) are recorded and change nothing: open/click tracking
 *   was deliberately removed from the system.
 *
 * The route is PUBLIC (Resend cannot send cookies); an unsigned request gets a 403, a server with no secret a
 * 503 (so Resend retries). The POST runs as `email.log.write` because `EmailLog` SELECT/UPDATE are bypass-only.
 */
@ApiTags("Email Webhook")
@Controller("notifications/email-webhook")
export class EmailWebhookController {
	public constructor(@Inject(NOTIFICATION_WEBHOOK_RECEPTION) private readonly reception: Pick<NotificationWebhookReception, "receiveResend">) {}

	/**
	 * Browsers (and accidental GETs) hit this and see a friendly explanation
	 * instead of a bare 404. Resend only ever POSTs to the webhook.
	 */
	// This exact URL is registered in the Resend dashboard, so it must not move
	// under `/api/v1` — the controller path stays `/notifications/email-webhook`
	// (no `apiPath()` prefix).
	@Public()
	@Get()
	@ApiOperation({ summary: "Webhook endpoint info (GET is not the delivery path)" })
	@ZodResponse(EmailWebhookInfoResponseSchema, { description: "Explains the endpoint" })
	public info(): EmailWebhookInfoResponse {
		return {
			ok: true,
			message: "This is Resend's delivery webhook. Resend POSTs signed events here; a browser GET is not the delivery path.",
			method: "POST",
			path: "/notifications/email-webhook",
		};
	}

	@Public()
	@PublicOperation(EMAIL_LOG_WRITE_OPERATION)
	@SkipMutationIntent()
	@Post()
	// Per-IP rate limiting on the delivery path only (defense-in-depth on top
	// of signature verification). Deliberately method-scoped: the GET info
	// route above is used by cloudflared/curl health checks, which must not
	// consume the per-IP bucket.
	@RateLimit(RATE_LIMIT_POLICY.webhook)
	@ApiOperation({
		summary: "Resend delivery webhook (signature-verified)",
		description:
			"Receives delivery events from Resend and updates EmailLog. Only accepts requests signed by Resend (standard-webhooks scheme). " +
			'Swagger\'s "Try it out" sends no signature, so it will always get 403 Missing webhook signature headers — that is the security boundary working. ' +
			"To test manually: run `pnpm --filter @workspace/api webhook:test-signature` and copy the printed header values + body into this form. Two gotchas: (1) the body must match EXACTLY — the signature covers the raw bytes, and Swagger's pretty-printed example will NOT match; (2) the values expire after 5 minutes, so paste fast or re-run the script.",
	})
	@ApiBody({
		type: ResendWebhookEventDto,
		description: "Resend delivery/tracking event. The signature covers the RAW body bytes, so paste the body exactly as the test script printed it — do not reformat.",
		examples: {
			delivered: {
				summary: "email.delivered (matches the test script)",
				value: { type: "email.delivered", data: { email_id: "e5e8d669-9ef0-44de-98f9-4097dcab36d8" } },
			},
			bounced: {
				summary: "email.bounced",
				value: {
					type: "email.bounced",
					data: {
						email_id: "e5e8d669-9ef0-44de-98f9-4097dcab36d8",
						bounce: { created_at: "2026-08-11T00:00:00.000Z", bounce_type: "permanent", raw: {} },
					},
				},
			},
			opened: {
				summary: "email.opened",
				value: {
					type: "email.opened",
					data: { created_at: "2026-08-11T00:00:00.000Z", email_id: "e5e8d669-9ef0-44de-98f9-4097dcab36d8" },
				},
			},
			clicked: {
				summary: "email.clicked",
				value: {
					type: "email.clicked",
					data: {
						created_at: "2026-08-11T00:00:00.000Z",
						email_id: "e5e8d669-9ef0-44de-98f9-4097dcab36d8",
						click: { ipAddress: "1.2.3.4", link: "https://app.example.com/reset?token=abc", timestamp: "2026-08-11T00:00:01.000Z", userAgent: "Mozilla/5.0" },
					},
				},
			},
		},
	})
	@ApiHeader({
		name: "webhook-id",
		required: true,
		description: "Unique webhook message id — or `svix-id` (Resend delivers via Svix and may use the `svix-*` names); both schemes are accepted",
	})
	@ApiHeader({ name: "webhook-timestamp", required: true, description: "Unix seconds when Resend signed the payload — or `svix-timestamp`" })
	@ApiHeader({
		name: "webhook-signature",
		required: true,
		description: "v1,<base64 HMAC-SHA256> over `<id>.<timestamp>.<rawBody>` using the webhook signing secret — or `svix-signature`",
	})
	// 200 (not 201) on purpose: Resend treats any 2xx as delivered, and the route has always answered 200.
	@ZodResponse(EmailWebhookReceivedResponseSchema, { description: "Webhook accepted" })
	public async receive(@Req() req: RawBodyRequest<FastifyRequest>, @CurrentActor({ allowAnonymous: true }) actor: ActorContext): Promise<EmailWebhookReceivedResponse> {
		await this.reception.receiveResend(actor, inboundWebhookRequest(req.rawBody, req.headers));
		return RECEIVED;
	}
}
