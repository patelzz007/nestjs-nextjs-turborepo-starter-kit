// ============================================
// notification-webhook-reception.ts - Resend's and Twilio's callbacks through the shared inbound path (ADR 070, ADR 081)
// ============================================
// verify (the provider's own scheme) → claim the delivery (Resend's `webhook-id`; Twilio's derived from its
// signed fields) → apply it → record the outcome in the received-webhook log. The routes answer exactly what
// they did: 403 for a missing or wrong signature, 503 when this server has no key (so the provider retries),
// 400 for a signed body that is not the provider's shape, 200 for everything else, including a redelivery,
// which is now answered without being applied again.

import { BadRequestException, ForbiddenException, HttpStatus, Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import { JsonValueSchema, maskPhone, ResendDeliveryDetailSchema, ResendWebhookEventSchema, type EmailLogStatus, type ResendWebhookEvent } from "@workspace/shared";
import { z } from "zod";

import type { ActorContext } from "../../../../platform/application/actor-context";
import {
	formFields,
	INBOUND_WEBHOOK_RECEIVER,
	missingStandardWebhookHeaders,
	RESEND_WEBHOOK_PROFILE,
	TWILIO_INBOUND_MESSAGE_PROFILE,
	TWILIO_STATUS_CALLBACK_PROFILE,
	type InboundWebhookEnvelope,
	type InboundWebhookHandling,
	type InboundWebhookReceiverPort,
	type InboundWebhookRequest,
	type RejectedSignatureCheck,
} from "../../../webhooks/inbound/public-api";
import { ApplyEmailDeliveryEventCommand } from "../commands/apply-email-delivery-event/apply-email-delivery-event.command";
import type { DeliveryEventRecordResult } from "../../domain/repositories/email-log.repository";
import { destinationHash } from "../../domain/policies/mask-destination";
import { EMAIL_LOG_ID_TAG } from "../../domain/value-objects/email-log-id-tag.value-object";
import { NOTIFICATION_ADMIN, NOTIFICATION_WEBHOOK_VERIFIERS } from "../ports/notifications.tokens";
import type { NotificationWebhookVerifiersPort } from "../ports/notification-webhook-verifiers.port";
import type { NotificationAdminService } from "./notification-admin.service";

/** Bound on the bounce / complaint reason stored as the row's `error` (the event column is VarChar(300)). */
const DELIVERY_DETAIL_MAX_LENGTH = 300;
/** A timestamp outside Standard Webhooks' tolerance: the reason words it as Svix does. */
const EXPIRED_SIGNATURE_PATTERN = /too old|too new/iu;
const TwilioStatusSchema = z.object({ MessageSid: z.string(), MessageStatus: z.string(), ErrorCode: z.string().optional() });
const TwilioInboundSchema = z.object({ From: z.string(), Body: z.string() });
/** Twilio's standard opt-out keywords (the Messaging Service also blocks the number on its side). */
const STOP_KEYWORDS: readonly string[] = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];

/** The one CommandBus capability the Resend callback uses (the bus satisfies it). */
export interface DeliveryEventDispatch {
	execute(command: ApplyEmailDeliveryEventCommand): Promise<DeliveryEventRecordResult>;
}

/** What a Twilio callback did: applied (a status recorded, a number suppressed) or nothing to act on. */
export type TwilioCallbackResult = "applied" | "ignored";

/**
 * Event type → EmailLog status. Delivery events we don't track return `undefined` and are recorded as
 * ignored; the tracking events (`email.opened` / `email.clicked`) are among them, since open and click
 * tracking was removed from the system.
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

/** A short reason out of a bounce or complaint (`permanent — 550 5.1.1 user unknown`), capped for the `error` column. */
function deliveryDetailOf(event: ResendWebhookEvent): string | undefined {
	const rawDetail = event.type === "email.bounced" ? event.data.bounce : event.type === "email.complained" ? event.data.complaint : undefined;
	const parsed = ResendDeliveryDetailSchema.safeParse(rawDetail);
	if (rawDetail === undefined || !parsed.success) {
		return undefined;
	}
	const { bounce_type: bounceType, complaint_type: complaintType, type, message, reason } = parsed.data;
	const parts = [bounceType ?? complaintType ?? type ?? "", message ?? reason ?? ""].filter((part: string): boolean => part.length > 0);
	return parts.length > 0 ? parts.join(" — ").slice(0, DELIVERY_DETAIL_MAX_LENGTH) : undefined;
}

/** A verified body read as JSON; anything else reads as nothing (and fails the event's schema). */
function jsonBodyOf(rawBody: Buffer): z.output<typeof JsonValueSchema> | null {
	try {
		return JsonValueSchema.parse(JSON.parse(rawBody.toString("utf8")));
	} catch {
		return null;
	}
}

/** Resend's route with no key: 503, so Resend retries once the secret is set instead of the outcome being lost. */
function resendNotConfigured(): ServiceUnavailableException {
	return new ServiceUnavailableException("The email delivery webhook is not configured on this server (RESEND_WEBHOOK_SECRET).");
}

function twilioNotConfigured(): ServiceUnavailableException {
	return new ServiceUnavailableException("Twilio is not configured on this server");
}

function twilioSignatureRejected(): ForbiddenException {
	return new ForbiddenException("Invalid Twilio signature");
}

@Injectable()
export class NotificationWebhookReception {
	private readonly logger: Logger = new Logger(NotificationWebhookReception.name);

	public constructor(
		@Inject(NOTIFICATION_WEBHOOK_VERIFIERS) private readonly verifiers: NotificationWebhookVerifiersPort,
		@Inject(CommandBus) private readonly commands: DeliveryEventDispatch,
		@Inject(NOTIFICATION_ADMIN) private readonly admin: Pick<NotificationAdminService, "applyTwilioStatus" | "applyTwilioStop">,
		@Inject(INBOUND_WEBHOOK_RECEIVER) private readonly receiver: InboundWebhookReceiverPort,
	) {}

	/** Resend's delivery event: the matching EmailLog row moves forward (once per webhook id). */
	public async receiveResend(actor: ActorContext, request: InboundWebhookRequest): Promise<void> {
		const verifier = this.verifiers.resend();
		if (verifier === null) {
			this.logger.error("Resend webhook received but RESEND_WEBHOOK_SECRET is not configured — answered 503 so Resend retries");
		}
		const reception = await this.receiver.receive<DeliveryEventRecordResult>({
			actor,
			profile: RESEND_WEBHOOK_PROFILE,
			request,
			verifier,
			// 200 (not 201): Resend treats any 2xx as delivered, and the route has always answered 200.
			successStatus: HttpStatus.OK,
			notConfigured: resendNotConfigured,
			rejected: (check: RejectedSignatureCheck): ForbiddenException => this.resendRejected(request, check),
			handle: (envelope: InboundWebhookEnvelope): Promise<InboundWebhookHandling<DeliveryEventRecordResult>> => this.applyResendEvent(actor, request, envelope),
		});
		if (reception.kind === "duplicate") {
			this.logger.log("Resend webhook redelivered — answered without applying it again");
		}
	}

	/** Twilio's delivery status of a message we sent. */
	public async receiveTwilioStatus(actor: ActorContext, request: InboundWebhookRequest): Promise<void> {
		await this.receiver.receive<TwilioCallbackResult>({
			actor,
			profile: TWILIO_STATUS_CALLBACK_PROFILE,
			request,
			verifier: this.verifiers.twilio("status"),
			successStatus: HttpStatus.OK,
			notConfigured: twilioNotConfigured,
			rejected: twilioSignatureRejected,
			handle: async (): Promise<InboundWebhookHandling<TwilioCallbackResult>> => {
				const status = TwilioStatusSchema.safeParse(Object.fromEntries(formFields(request.rawBody)));
				if (!status.success) {
					throw new BadRequestException("The callback is not a Twilio status callback.");
				}
				const { MessageSid: messageSid, MessageStatus: messageStatus, ErrorCode: errorCode } = status.data;
				await this.admin.applyTwilioStatus(actor, { messageSid, status: messageStatus, errorCode: errorCode ?? null });
				return { outcome: "RECORDED", result: "applied" };
			},
		});
	}

	/** A message someone sent to our number: STOP (or another opt-out keyword) suppresses it. */
	public async receiveTwilioInbound(actor: ActorContext, request: InboundWebhookRequest): Promise<void> {
		await this.receiver.receive<TwilioCallbackResult>({
			actor,
			profile: TWILIO_INBOUND_MESSAGE_PROFILE,
			request,
			verifier: this.verifiers.twilio("inbound"),
			successStatus: HttpStatus.OK,
			notConfigured: twilioNotConfigured,
			rejected: twilioSignatureRejected,
			handle: async (): Promise<InboundWebhookHandling<TwilioCallbackResult>> => {
				const message = TwilioInboundSchema.safeParse(Object.fromEntries(formFields(request.rawBody)));
				if (!message.success) {
					throw new BadRequestException("The callback is not a Twilio inbound message.");
				}
				if (!STOP_KEYWORDS.includes(message.data.Body.trim().toUpperCase())) {
					return { outcome: "IGNORED", result: "ignored" };
				}
				await this.admin.applyTwilioStop(actor, destinationHash(message.data.From), maskPhone(message.data.From));
				return { outcome: "RECORDED", result: "applied" };
			},
		});
	}

	private async applyResendEvent(
		actor: ActorContext,
		request: InboundWebhookRequest,
		envelope: InboundWebhookEnvelope,
	): Promise<InboundWebhookHandling<DeliveryEventRecordResult>> {
		const parsed = ResendWebhookEventSchema.safeParse(jsonBodyOf(request.rawBody));
		if (!parsed.success || envelope.deliveryId === null) {
			// Correctly signed but not a shape we understand: refused loudly (Resend retries and the failure is
			// visible in the log) instead of acknowledged and dropped.
			this.logger.error(`Signed Resend webhook payload failed schema validation${parsed.success ? " (no webhook id)" : `: ${parsed.error.message}`}`);
			throw new BadRequestException("Webhook payload does not match the expected Resend event shape.");
		}
		const event = parsed.data;
		const taggedEmailLogId = z.uuid().safeParse(event.data.tags?.[EMAIL_LOG_ID_TAG]);
		const result = await this.commands.execute(
			new ApplyEmailDeliveryEventCommand(actor, {
				webhookId: envelope.deliveryId,
				eventType: event.type,
				resendId: event.data.email_id,
				taggedEmailLogId: taggedEmailLogId.success ? taggedEmailLogId.data : undefined,
				status: webhookStatusFor(event.type),
				detail: deliveryDetailOf(event),
				occurredAt: Date.parse(event.created_at),
			}),
		);
		if (result.kind === "duplicate") {
			return { outcome: "DUPLICATE", result, eventType: event.type };
		}
		if (result.outcome === "unmatched") {
			// Signed, for an email this system never sent (the Resend dashboard, another app on the account).
			this.logger.log(`Resend webhook for unknown "resendId" ${event.data.email_id} (${event.type}) — recorded as unmatched`);
		} else if (result.outcome === "stale") {
			this.logger.log(`Resend webhook ${event.type} for "resendId" ${event.data.email_id} is older than the row's latest outcome — recorded as stale`);
		}
		return { outcome: "RECORDED", result, eventType: event.type };
	}

	/** 403, naming what was wrong, so a manual test (Swagger, curl) can tell a missing header from an expired one. */
	private resendRejected(request: InboundWebhookRequest, check: RejectedSignatureCheck): ForbiddenException {
		this.logger.warn(`Resend webhook refused: ${check.reason}`);
		if (check.verdict === "MISSING") {
			return new ForbiddenException(
				`Missing webhook signature header(s): ${missingStandardWebhookHeaders(request.headers).join(", ")}. Resend signs every webhook with these headers — a browser/curl request without them is rejected by design.`,
			);
		}
		const hint = EXPIRED_SIGNATURE_PATTERN.test(check.reason)
			? "webhook-timestamp is outside the 5-minute window — the signature expired while you were copying it into Swagger. Re-run the script and paste faster (within 5 minutes)."
			: "the signature does not match the body bytes — the body in the request must be byte-identical to the one that was signed. Swagger's pretty-printed example is NOT byte-identical; paste the single-line body exactly as the script printed it.";
		return new ForbiddenException(`Invalid webhook signature (${check.reason}). ${hint}`);
	}
}
