import { Controller, ForbiddenException, Get, Headers, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import { ApiBody, ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ThrottlerGuard } from "@nestjs/throttler";
import { Resend } from "resend";
import { z } from "zod";
import type { FastifyRequest } from "fastify";

import type { EmailLogStatus } from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";
import { LogService } from "../../logs/logs.service";
import { Public } from "../../auth/decorators/public.decorator";

import { EmailLogService, type WebhookUpdateResult } from "./email-log.service";
import { ResendWebhookEventDto } from "./dtos/resend-webhook-event.dto";

/** Raw webhook headers Resend signs (standard-webhooks). */
const WebhookHeadersSchema = z
	.object({
		id: z.string().min(1),
		timestamp: z.string().min(1),
		signature: z.string().min(1),
	})
	.strict();

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
 * `RESEND_WEBHOOK_SECRET` signature get a 403. Requires the Nest app to be
 * booted with `rawBody: true` so the signature covers the exact bytes Resend
 * sent (the JSON parser would otherwise re-encode whitespace).
 */
@ApiTags("Email Webhook")
@Controller("notifications/email-webhook")
export class EmailWebhookController {
	private readonly resend: Resend;

	constructor(
		private readonly config: TypedConfigService,
		private readonly emailLogService: EmailLogService,
		private readonly logService: LogService,
	) {
		this.resend = new Resend(this.config.resendApiKey);
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
	@ApiOkResponse({ description: "Explains the endpoint" })
	public info(): {
		readonly ok: true;
		readonly message: string;
		readonly method: "POST";
		readonly path: string;
	} {
		return {
			ok: true,
			message: "This is Resend's delivery webhook. Resend POSTs signed events here; a browser GET is not the delivery path.",
			method: "POST",
			path: "/notifications/email-webhook",
		};
	}

	@Public()
	@Post()
	// Per-IP rate limiting on the delivery path only (defense-in-depth on top
	// of signature verification). Deliberately method-scoped: the GET info
	// route above is used by cloudflared/curl health checks, which must not
	// consume the per-IP bucket.
	@UseGuards(ThrottlerGuard)
	@HttpCode(200)
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
	@ApiOkResponse({ description: "Webhook accepted" })
	public async receive(@Req() req: RawBodyRequest<FastifyRequest>, @Headers() headers: Record<string, string | undefined>): Promise<{ readonly received: true }> {
		const secret: string = this.config.resendWebhookSecret;
		if (secret.length === 0) {
			// No secret configured — the webhook is not wired up. Still answer 200
			// so Resend stops retrying, and log once.
			this.logService.warn("Resend webhook received but RESEND_WEBHOOK_SECRET is not configured", { context: "EmailWebhookController" });
			return { received: true };
		}

		const rawBody: string = typeof req.rawBody === "string" ? req.rawBody : Buffer.isBuffer(req.rawBody) ? req.rawBody.toString("utf8") : JSON.stringify(req.body ?? {});

		// Resend delivers webhooks through Svix's infrastructure (the sender UA is
		// `Svix-Webhooks/rolling`). Depending on the sender configuration the
		// signature headers arrive as the standard-webhooks names
		// (webhook-id/webhook-timestamp/webhook-signature) OR Svix's native names
		// (svix-id/svix-timestamp/svix-signature). Read BOTH schemes so a genuine
		// delivery is never mistaken for a header-less request.
		const readWebhookHeader = (name: string): string | undefined => {
			const value: string | undefined = headers[name];
			if (typeof value === "string" && value.length > 0) {
				return value;
			}
			const svixName: string = name.replace("webhook-", "svix-");
			const svixValue: string | undefined = headers[svixName];
			return typeof svixValue === "string" && svixValue.length > 0 ? svixValue : undefined;
		};

		const parsedHeaders = WebhookHeadersSchema.safeParse({
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
			const userAgent: string = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : "(none)";
			const remoteIp: string = typeof req.ip === "string" ? req.ip : "(unknown)";
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
		let event: unknown;
		try {
			event = this.resend.webhooks.verify({
				payload: rawBody,
				headers: parsedHeaders.data,
				webhookSecret: secret,
			});
		} catch (cause: unknown) {
			// Surface the ACTUAL reason instead of a black-box 403: the
			// standard-webhooks verifier throws a specific message
			// ("Message timestamp too old" vs "No matching signature found"),
			// which maps to two completely different user errors. The reason is
			// allowlisted to the verifier's known messages so internal errors
			// never leak into the response.
			const rawReason: string = cause instanceof Error ? cause.message : "unknown verification error";
			const reason: string = /too old|too new|matching signature|missing required header/i.test(rawReason) ? rawReason : "unexpected verification error";
			this.logService.warn(`Webhook signature verification failed: ${rawReason}`, { context: "EmailWebhookController" });
			const hint: string = /too old|too new/i.test(reason)
				? "webhook-timestamp is outside the 5-minute window — the signature expired while you were copying it into Swagger. Re-run the script and paste faster (within 5 minutes)."
				: "the signature does not match the body bytes — the body in the request must be byte-identical to the one that was signed. Swagger's pretty-printed example is NOT byte-identical; paste the single-line body exactly as the script printed it.";
			throw new ForbiddenException(`Invalid webhook signature (${reason}). ${hint}`);
		}

		const eventType: string = typeof event === "object" && event !== null && "type" in event && typeof event.type === "string" ? event.type : "";
		const emailId: string | undefined = this.extractEmailId(event);
		if (emailId === undefined) {
			return { received: true };
		}

		// Tracking events (email.opened / email.clicked / email.forwarded) are
		// acknowledged and ignored — only delivery outcomes update the log.
		const status: EmailLogStatus | undefined = webhookStatusFor(eventType);
		if (status === undefined) {
			return { received: true };
		}
		// Bounce / complaint events carry a reason — surface it as the row's
		// `error` so the admin log shows WHY, not just the status flip.
		const detail: string | undefined = this.extractDeliveryDetail(eventType, event);
		const outcome: WebhookUpdateResult = await this.emailLogService.updateStatusByResendId(emailId, status, detail);
		if (outcome === "not_found") {
			// Signed event for an email this system never sent (spoofed, or sent
			// from the Resend dashboard / another app on the same account).
			// Acknowledged so Resend stops retrying — nothing is written.
			this.logService.info(`Webhook for unknown resend_id ${emailId} (${eventType}) — ignored, no matching EmailLog row`, { context: "EmailWebhookController" });
		} else if (outcome === "stale") {
			// Signed event that would regress an already-advanced row (e.g. a
			// replayed `email.sent` after `delivered`). Ignored on purpose.
			this.logService.info(`Webhook ignored: ${eventType} for resend_id ${emailId} would regress status — row already delivered/terminal`, {
				context: "EmailWebhookController",
			});
		}
		return { received: true };
	}

	/**
	 * Pull a short human-readable reason out of `email.bounced` /
	 * `email.complained` events (e.g. `permanent — 550 5.1.1 user unknown`),
	 * capped so it never bloats the `error` column. Delivery events without a
	 * reason return `undefined`.
	 */
	private extractDeliveryDetail(eventType: string, event: unknown): string | undefined {
		if (typeof event !== "object" || event === null || !("data" in event)) {
			return undefined;
		}
		const data: unknown = event.data;
		if (typeof data !== "object" || data === null) {
			return undefined;
		}
		const detailObject: unknown =
			eventType === "email.bounced" && "bounce" in data ? data.bounce : eventType === "email.complained" && "complaint" in data ? data.complaint : undefined;
		if (typeof detailObject !== "object" || detailObject === null) {
			return undefined;
		}
		// Defensive key set: Resend's webhook wire format uses `bounce_type` /
		// `complaint_type`, the SDK's typed models use `type` / `subType` / `message`.
		const kind: unknown =
			"bounce_type" in detailObject
				? detailObject.bounce_type
				: "complaint_type" in detailObject
					? detailObject.complaint_type
					: "type" in detailObject
						? detailObject.type
						: undefined;
		const message: unknown = "message" in detailObject ? detailObject.message : "reason" in detailObject ? detailObject.reason : undefined;
		const parts: readonly string[] = [typeof kind === "string" ? kind : "", typeof message === "string" ? message : ""].filter((part: string): boolean => part.length > 0);
		return parts.length > 0 ? parts.join(" — ").slice(0, 300) : undefined;
	}

	/** Pull the Resend email id out of a verified event payload. */
	private extractEmailId(event: unknown): string | undefined {
		if (typeof event !== "object" || event === null || !("data" in event)) {
			return undefined;
		}
		const data: unknown = event.data;
		if (typeof data !== "object" || data === null) {
			return undefined;
		}
		const candidate: unknown = "email_id" in data ? data.email_id : "id" in data ? data.id : undefined;
		return typeof candidate === "string" && candidate.length > 0 ? candidate : undefined;
	}
}
