import { BadRequestException, Controller, ForbiddenException, Get, Headers, Post, Req, ServiceUnavailableException, UseGuards } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import { ApiBody, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ThrottlerGuard } from "@nestjs/throttler";
import { Resend } from "resend";
import { z } from "zod";
import type { FastifyRequest } from "fastify";

import {
	CaughtValueSchema,
	EmailWebhookInfoResponseSchema,
	EmailWebhookReceivedResponseSchema,
	NonEmptyStringSchema,
	ResendDeliveryDetailSchema,
	ResendWebhookEventSchema,
	ResendWebhookHeadersSchema,
	StringValueSchema,
	type EmailLogStatus,
	type EmailWebhookInfoResponse,
	type EmailWebhookReceivedResponse,
	type ResendWebhookEvent,
} from "@workspace/shared";

import { ZodResponse } from "../../../common/decorators/zod-response.decorators";
import { readCaughtErrorMessage } from "../../../common/utils/caught-error";
import { TypedConfigService } from "../../../config/typed-config.service";
import { LogService } from "../../logs/logs.service";
import { Public } from "../../auth/decorators/public.decorator";
import { SkipMutationIntent } from "../../auth/decorators/skip-mutation-intent.decorator";
import { RlsBypass } from "../../auth/decorators/rls-bypass.decorator";

import { EmailLogService } from "./email-log.service";
import { EMAIL_LOG_ID_TAG } from "./email-sender.service";
import { ResendWebhookEventDto } from "./dtos/resend-webhook-event.dto";

/**
 * Event type → EmailLog status. Delivery events we don't track return
 * `undefined` and are ignored. A switch (not a Record) keeps the lookup
 * honest — a Record<string, …> would claim every key is known.
 *
 * The tracking events (`email.opened` / `email.clicked`) are deliberately NOT
 * here — open/click tracking was removed from the system, so they are
 * acknowledged and ignored (only delivery outcomes update the log).
 */
function webhookStatusFor(eventType: string): EmailLogStatus | undefined {
	switch (eventType) {
		case "email.sent":
			return "sent";
		case "email.delivered":
			return "delivered";
		case "email.bounced":
			return "bounced";
		case "email.complained":
			return "complained";
		case "email.failed":
			return "failed";
		default:
			return undefined;
	}
}

/**
 * Receives Resend's delivery + tracking webhooks and updates the matching
 * `EmailLog` row:
 *
 * - Delivery events (`email.delivered` / `email.bounced` / `email.complained`
 *   / `email.failed`) flip the row's `status`; bounce/complaint details are
 *   captured into `error` so the admin sees WHY it bounced.
 * - Tracking events (`email.opened` / `email.clicked`) are acknowledged and
 *   ignored — open/click tracking was deliberately removed from the system.
 *
 * The route is PUBLIC (Resend cannot send cookies) but the signature is
 * verified via `resend.webhooks.verify()` — requests without a valid
 * `RESEND_WEBHOOK_SECRET` signature get a 403. `@RlsBypass()` is required on
 * POST because `email_logs` SELECT/UPDATE are bypass-only policies.
 */
@ApiTags("Email Webhook")
@Controller("notifications/email-webhook")
export class EmailWebhookController {
	/** Resend SDK instance (signature verification); `null` when RESEND_API_KEY is unset. */
	private readonly resend: Resend | null;

	constructor(
		private readonly config: TypedConfigService,
		private readonly emailLogService: EmailLogService,
		private readonly logService: LogService,
	) {
		const apiKey: string | null = this.config.resendApiKey;
		this.resend = apiKey === null ? null : new Resend(apiKey);
	}

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
	@RlsBypass()
	@SkipMutationIntent()
	@Post()
	// Per-IP rate limiting on the delivery path only (defense-in-depth on top
	// of signature verification). Deliberately method-scoped: the GET info
	// route above is used by cloudflared/curl health checks, which must not
	// consume the per-IP bucket.
	@UseGuards(ThrottlerGuard)
	@ApiOperation({
		summary: "Resend delivery webhook (signature-verified)",
		description:
			"Receives delivery events from Resend and updates EmailLog. Only accepts requests signed by Resend (standard-webhooks scheme). " +
			'Swagger\'s "Try it out" sends no signature, so it will always get 403 Missing webhook signature headers — that is the security boundary working. ' +
			"To test manually: run `pnpm --filter @workspace/api exec tsx scripts/test-webhook-signature.ts` and copy the printed header values + body into this form. Two gotchas: (1) the body must match EXACTLY — the signature covers the raw bytes, and Swagger's pretty-printed example will NOT match; (2) the values expire after 5 minutes, so paste fast or re-run the script.",
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
	public async receive(@Req() req: RawBodyRequest<FastifyRequest>, @Headers() headers: Record<string, string | undefined>): Promise<EmailWebhookReceivedResponse> {
		const secret: string | null = this.config.resendWebhookSecret;
		const resend: Resend | null = this.resend;
		if (secret === null || resend === null) {
			// Not configured: the event cannot be verified, so it must not be
			// acknowledged either — 503 makes Resend retry it once the secret is
			// set, instead of the delivery outcome being silently lost.
			this.logService.error("Resend webhook received but RESEND_WEBHOOK_SECRET / RESEND_API_KEY is not configured — answered 503 so Resend retries", {
				context: "EmailWebhookController",
			});
			throw new ServiceUnavailableException("The email delivery webhook is not configured on this server (RESEND_WEBHOOK_SECRET / RESEND_API_KEY).");
		}

		const rawBody: string = this.readRawBody(req);

		const readWebhookHeader = (name: string): string | undefined => {
			const direct = NonEmptyStringSchema.safeParse(headers[name]);
			if (direct.success) {
				return direct.data;
			}
			const svixName: string = name.replace("webhook-", "svix-");
			const svix = NonEmptyStringSchema.safeParse(headers[svixName]);
			return svix.success ? svix.data : undefined;
		};

		const parsedHeaders = ResendWebhookHeadersSchema.safeParse({
			id: readWebhookHeader("webhook-id"),
			timestamp: readWebhookHeader("webhook-timestamp"),
			signature: readWebhookHeader("webhook-signature"),
		});
		if (!parsedHeaders.success) {
			// Name exactly which of the three signature headers were absent/empty
			// (under either naming scheme) so the failure is debuggable.
			const missing: readonly string[] = ["id", "timestamp", "signature"].filter((suffix: string): boolean => readWebhookHeader(`webhook-${suffix}`) === undefined);
			// Log the sender + which signature-ish headers DID arrive: a genuine
			// Resend delivery always carries one of the two naming schemes, so
			// this line proves whether the delivery is real (and which names it
			// used) or a browser/curl probe.
			const userAgent: string = NonEmptyStringSchema.safeParse(req.headers["user-agent"]).data ?? "(none)";
			const remoteIp: string = NonEmptyStringSchema.safeParse(req.ip).data ?? "(unknown)";
			const signatureHeadersSeen: string = Object.keys(req.headers)
				.filter((headerName: string): boolean => /id|signature|timestamp/i.test(headerName))
				.join(", ");
			this.logService.warn(
				`Webhook rejected: missing signature header(s) ${missing.map((suffix: string): string => `webhook-${suffix}/svix-${suffix}`).join(", ")} — UA=${userAgent} ip=${remoteIp} signature-ish headers seen: ${signatureHeadersSeen || "(none)"}`,
				{ context: "EmailWebhookController" },
			);
			throw new ForbiddenException(
				`Missing webhook signature header(s): ${missing.map((suffix: string): string => `webhook-${suffix}/svix-${suffix}`).join(", ")}. Resend signs every webhook with these headers — a browser/curl request without them is rejected by design.`,
			);
		}
		// Verify the signature FIRST — the ONLY thing that can make this a 403.
		// Keeping this in its own try/catch means a later DB failure propagates
		// as a 500 (handled by the global filter), never as a misleading
		// "Invalid webhook signature" that leaks the DB error to a public route.
		let resendEvent: ResendWebhookEvent;
		try {
			const verified = resend.webhooks.verify({
				payload: rawBody,
				headers: parsedHeaders.data,
				webhookSecret: secret,
			});
			resendEvent = ResendWebhookEventSchema.parse(verified);
		} catch (cause) {
			if (cause instanceof z.ZodError) {
				// Correctly signed but not a shape we understand: reject loudly (Resend
				// retries and the failure is visible) instead of acknowledging and dropping it.
				this.logService.error(`Signed webhook payload failed schema validation: ${cause.message}`, { context: "EmailWebhookController" });
				throw new BadRequestException("Webhook payload does not match the expected Resend event shape.");
			}
			const caught = CaughtValueSchema.parse(cause);
			const rawReason: string = readCaughtErrorMessage(caught);
			const reason: string = /too old|too new|matching signature|missing required header/i.test(rawReason) ? rawReason : "unexpected verification error";
			this.logService.warn(`Webhook signature verification failed: ${rawReason}`, { context: "EmailWebhookController" });
			const hint: string = /too old|too new/i.test(reason)
				? "webhook-timestamp is outside the 5-minute window — the signature expired while you were copying it into Swagger. Re-run the script and paste faster (within 5 minutes)."
				: "the signature does not match the body bytes — the body in the request must be byte-identical to the one that was signed. Swagger's pretty-printed example is NOT byte-identical; paste the single-line body exactly as the script printed it.";
			throw new ForbiddenException(`Invalid webhook signature (${reason}). ${hint}`);
		}
		const eventType: string = resendEvent.type;
		const emailId: string = resendEvent.data.email_id;
		const taggedEmailLogId = z.uuid().safeParse(resendEvent.data.tags?.[EMAIL_LOG_ID_TAG]);
		const result = await this.emailLogService.applyDeliveryEvent({
			webhookId: parsedHeaders.data.id,
			eventType,
			resendId: emailId,
			taggedEmailLogId: taggedEmailLogId.success ? taggedEmailLogId.data : undefined,
			// Tracking events (opened / clicked / forwarded / delayed) map to no status: recorded as `ignored`.
			status: webhookStatusFor(eventType),
			// Bounce / complaint reasons become the row's `error`, so the admin log shows WHY.
			detail: this.extractDeliveryDetail(eventType, resendEvent),
			occurredAt: Date.parse(resendEvent.created_at),
		});
		if (result.kind === "duplicate") {
			this.logService.info(`Webhook ${parsedHeaders.data.id} already recorded — redelivery ignored`, { context: "EmailWebhookController" });
		} else if (result.outcome === "unmatched") {
			// Signed event for an email this system never sent (sent from the Resend
			// dashboard / another app on the same account). Recorded, nothing applied.
			this.logService.info(`Webhook for unknown resend_id ${emailId} (${eventType}) — recorded as unmatched`, { context: "EmailWebhookController" });
		} else if (result.outcome === "stale") {
			// Older than (or a regression of) what the row already shows — recorded, not applied.
			this.logService.info(`Webhook ${eventType} for resend_id ${emailId} is older than the row's latest outcome — recorded as stale`, { context: "EmailWebhookController" });
		}
		return { received: true };
	}

	private readRawBody(req: RawBodyRequest<FastifyRequest>): string {
		const raw = req.rawBody;
		const asString = StringValueSchema.safeParse(raw);
		if (asString.success) {
			return asString.data;
		}
		if (Buffer.isBuffer(raw)) {
			return raw.toString("utf8");
		}
		return JSON.stringify(req.body ?? {});
	}

	/**
	 * Pull a short human-readable reason out of `email.bounced` /
	 * `email.complained` events (e.g. `permanent — 550 5.1.1 user unknown`),
	 * capped so it never bloats the `error` column. Delivery events without a
	 * reason return `undefined`.
	 */
	private extractDeliveryDetail(eventType: string, event: ResendWebhookEvent): string | undefined {
		const data = event.data;
		const rawDetail = eventType === "email.bounced" ? data.bounce : eventType === "email.complained" ? data.complaint : undefined;
		if (rawDetail === undefined) {
			return undefined;
		}
		const parsed = ResendDeliveryDetailSchema.safeParse(rawDetail);
		if (!parsed.success) {
			return undefined;
		}
		const d = parsed.data;
		const kind = d.bounce_type ?? d.complaint_type ?? d.type ?? "";
		const message = d.message ?? d.reason ?? "";
		const parts = [kind, message].filter((p): p is string => p.length > 0);
		return parts.length > 0 ? parts.join(" — ").slice(0, 300) : undefined;
	}
}
