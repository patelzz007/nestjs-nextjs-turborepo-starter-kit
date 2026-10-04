import { z } from "zod";

import { EpochMsSchema } from "../api/common";
import { defineListQuery, listFilter, ListSearchSchema } from "../api/list-query";

/**
 * Email template system — shared contract.
 *
 * Single source of truth for the template registry (which templates exist),
 * the admin preview payload (what the preview endpoint returns), and the
 * send result (what `EmailSenderService.send()` returns). Kept in
 * `@workspace/shared` so the API (`EmailPreviewController`, `EmailSenderService`)
 * and the admin preview page parse the exact same shapes.
 */

// ── Template keys ─────────────────────────────────────────────────────────

/**
 * Every email template in the system. Adding a template means adding a key
 * here AND a matching factory in `EMAIL_TEMPLATE_PREVIEWS` (the registry
 * completeness test fails otherwise).
 */
export const EmailTemplateKeySchema = z.enum([
	"verification",
	"password-reset",
	"password-changed",
	"account-locked",
	"welcome",
	"security-alert",
	"two-factor-enabled",
	"two-factor-disabled",
	"admin-alert",
	"api-key-created",
	"reward-claim-otp",
	"referrer-reward-credited",
	"login-verification",
	"merchant-invite",
	"team-member-invite",
]);

export type EmailTemplateKey = z.output<typeof EmailTemplateKeySchema>;

// ── Template metadata (list view) ─────────────────────────────────────────

/** Static metadata for one template — used by the admin preview list. */
export const EmailTemplateMetaSchema = z.object({
	key: EmailTemplateKeySchema,
	label: z.string().min(1),
	description: z.string().min(1),
	sampleTo: z.email(),
});

export type EmailTemplateMeta = z.output<typeof EmailTemplateMetaSchema>;

// ── Sample props (serialized for display) ────────────────────────────────

/** Serializable value allowed inside rendered sample props. */
export const EmailPreviewPropValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export type EmailPreviewPropValue = z.output<typeof EmailPreviewPropValueSchema>;

// ── Preview list response (admin index) ───────────────────────────────────

/** Envelope data for `GET /notifications/email-preview`. */
export const EmailPreviewListResponseSchema = z.object({
	templates: z.array(EmailTemplateMetaSchema),
});

export type EmailPreviewListResponse = z.output<typeof EmailPreviewListResponseSchema>;

// ── Preview payload (single template) ─────────────────────────────────────

/**
 * Full preview for one template: the rendered HTML + plain text, plus the
 * subject / recipient / preview-text so the admin page can show everything
 * without ever constructing a template itself.
 */
export const EmailPreviewSchema = z.object({
	key: EmailTemplateKeySchema,
	label: z.string().min(1),
	description: z.string().min(1),
	subject: z.string().min(1),
	to: z.email(),
	previewText: z.string().min(1),
	html: z.string().min(1),
	text: z.string().min(1),
	props: z.record(z.string(), EmailPreviewPropValueSchema),
});

export type EmailPreview = z.output<typeof EmailPreviewSchema>;

// ── Send result ───────────────────────────────────────────────────────────

/** Outcome of `EmailSenderService.send()`. Never throws — callers inspect this. */
export const EmailSendResultSchema = z.discriminatedUnion("ok", [
	z.object({
		ok: z.literal(true),
		id: z.string(),
		mode: z.enum(["send", "log-only", "noop", "queued"]),
	}),
	z.object({
		ok: z.literal(false),
		/**
		 * - `persistence` — the email log row could not be written, so nothing was sent;
		 * - `queue`       — the send could not be handed to the email queue (the log row is marked failed).
		 */
		reason: z.enum(["invalid-props", "config", "timeout", "rate-limited", "api-error", "persistence", "queue"]),
		detail: z.string().optional(),
	}),
]);

export type EmailSendResult = z.output<typeof EmailSendResultSchema>;

/** Resend SDK `emails.send()` response shape (parsed at the network boundary). */
export const ResendSendErrorSchema = z
	.object({
		/** Resend's machine-readable error code (`validation_error`, `rate_limit_exceeded`, …). */
		name: z.string(),
		message: z.string(),
		statusCode: z.number().int().nullable(),
	})
	.strict();

/**
 * Resend SDK `emails.send()` response shape (parsed at the network boundary).
 *
 * `.loose()` — the Resend SDK includes extra fields (e.g. `headers`) that
 * are not part of our contract but must not cause a parse failure.
 */
export const ResendSendResponseSchema = z
	.object({
		data: z.object({ id: z.string() }).nullable(),
		error: ResendSendErrorSchema.nullable(),
	})
	.loose();

export type ResendSendResponse = z.output<typeof ResendSendResponseSchema>;

// ── Email log status (webhook updates) ────────────────────────────────────

/**
 * Lifecycle of one outbound email. `pending` is written BEFORE the provider is
 * called (so no email is ever sent without a log row); the send outcome moves
 * it to `sent` / `failed`, and the Resend webhook moves it forward from there.
 */
export const EmailLogStatusSchema = z.enum(["pending", "sent", "delivered", "bounced", "complained", "failed"]);

export type EmailLogStatus = z.output<typeof EmailLogStatusSchema>;

/**
 * What a verified delivery-webhook event did to its email log row (`email_delivery_events.outcome`):
 * `applied` moved the row forward; `stale` is older than (or a regression of) the row's newest
 * applied outcome; `unmatched` names an email this system never sent; `ignored` is a tracking
 * event that never changes the row. Mirrors the Prisma enum `EmailDeliveryOutcome`.
 */
export const DeliveryEventOutcomeSchema = z.enum(["applied", "stale", "unmatched", "ignored"]);

export type DeliveryEventOutcome = z.output<typeof DeliveryEventOutcomeSchema>;

// ── Resend webhook event (inbound delivery payload) ───────────────────────

/**
 * Event types Resend can POST to the delivery webhook.
 *
 * Delivery events map to an `EmailLogStatus` (see `webhookStatusFor` in the
 * API controller). The tracking events (`email.opened` / `email.clicked`) and
 * `email.forwarded` / `email.delivery_delayed` are acknowledged and ignored
 * — open/click tracking was deliberately removed from the system, so only
 * delivery outcomes update the log.
 */
export const ResendWebhookEventTypeSchema = z.enum([
	"email.sent",
	"email.delivered",
	"email.bounced",
	"email.complained",
	"email.failed",
	"email.delivery_delayed",
	"email.opened",
	"email.clicked",
	"email.forwarded",
]);

export type ResendWebhookEventType = z.output<typeof ResendWebhookEventTypeSchema>;

// ── Bounce / complaint detail (extracted from webhook data) ────────────────

/**
 * The `bounce` or `complaint` sub-object inside a Resend delivery webhook.
 * Resend's wire format uses `bounce_type` / `complaint_type`; the SDK's
 * typed models use `type` / `subType` / `message`. This schema covers both
 * naming conventions with `.loose()` so unknown future fields don't break.
 */
export const ResendDeliveryDetailSchema = z
	.object({
		/** `bounce_type` or `complaint_type` or `type` — the human-readable category. */
		bounce_type: z.string().optional(),
		complaint_type: z.string().optional(),
		type: z.string().optional(),
		/** `message` or `reason` — the human-readable detail. */
		message: z.string().optional(),
		reason: z.string().optional(),
		subType: z.string().optional(),
	})
	.loose();

export type ResendDeliveryDetail = z.output<typeof ResendDeliveryDetailSchema>;

// ── Webhook event ─────────────────────────────────────────────────────────

/**
 * One delivery event as POSTed by Resend to `/notifications/email-webhook`.
 *
 * IMPORTANT: this schema is for Swagger documentation only. The endpoint
 * verifies the payload via `resend.webhooks.verify()` over the RAW body, so
 * this shape is never used as a validation pipe — the signature check is the
 * gate. `data` is intentionally loose: Resend includes many more fields than
 * we consume (`from`, `subject`, `to`, …) and they change over time.
 */
export const ResendWebhookEventSchema = z
	.object({
		type: ResendWebhookEventTypeSchema,
		/** When Resend observed the event (ISO-8601) — orders events that arrive out of order. */
		created_at: z.iso.datetime({ offset: true }),
		data: z
			.object({
				/** The Resend id of the outbound email this event is about. */
				email_id: z.string().min(1),
				/** Tags set at send time — the API tags every email with its `email_log_id`. */
				tags: z.record(z.string(), z.string()).optional(),
				/** Present on `email.bounced` events. */
				bounce: ResendDeliveryDetailSchema.optional(),
				/** Present on `email.complained` events. */
				complaint: ResendDeliveryDetailSchema.optional(),
			})
			.loose(),
	})
	.loose();

export type ResendWebhookEvent = z.output<typeof ResendWebhookEventSchema>;

// ── Email log entry (admin audit list) ────────────────────────────────────

/** One `email_logs` row as exposed to the admin panel. */
export const EmailLogEntrySchema = z.object({
	id: z.string().min(1),
	templateKey: EmailTemplateKeySchema,
	to: z.string().min(1),
	subject: z.string().min(1),
	status: EmailLogStatusSchema,
	resendId: z.string().nullable().optional(),
	error: z.string().nullable().optional(),
	createdAt: EpochMsSchema,
	updatedAt: EpochMsSchema,
});

export type EmailLogEntry = z.output<typeof EmailLogEntrySchema>;

// ── Email log create (API persistence) ────────────────────────────────────

const EmailLogMetadataValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

/** Payload used to create a new `email_logs` row. */
export const EmailLogCreateSchema = z
	.object({
		templateKey: z.string().min(1),
		to: z.email(),
		subject: z.string().min(1),
		status: EmailLogStatusSchema,
		resendId: z.string().optional(),
		error: z.string().optional(),
		/** Send duration in ms — carried on the attempt event for the jobs view. */
		durationMs: z.number().int().nonnegative().optional(),
		metadata: z.record(z.string(), EmailLogMetadataValueSchema).optional(),
	})
	.strict();

export type EmailLogCreate = z.output<typeof EmailLogCreateSchema>;

/** `GET /notifications/email-log` list query (newest first) — see docs/technical/api/list-queries.md. */
export const emailLogListQuery = defineListQuery({
	sortable: ["createdAt", "subject", "to", "status"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {
		status: listFilter.enumeration(EmailLogStatusSchema, { eq: true, in: true }),
		templateKey: listFilter.string({ eq: true, in: true }),
		createdAt: listFilter.epochMs({ gte: true, lte: true }),
	},
	params: { search: ListSearchSchema },
});
export const EmailLogListQuerySchema = emailLogListQuery.schema;
export type EmailLogListQuery = z.output<typeof EmailLogListQuerySchema>;
export type EmailLogListSortField = (typeof emailLogListQuery.sortable)[number];

// ── Resend webhook signature headers ──────────────────────────────────────

/** Raw webhook headers Resend signs (standard-webhooks / Svix naming). */
export const ResendWebhookHeadersSchema = z
	.object({
		id: z.string().min(1),
		timestamp: z.string().min(1),
		signature: z.string().min(1),
	})
	.strict();

export type ResendWebhookHeaders = z.output<typeof ResendWebhookHeadersSchema>;

// ── Resend webhook responses ──────────────────────────────────────────────

/** `GET /notifications/email-webhook` payload — explains the endpoint to a browser / health check (Resend only POSTs). */
export const EmailWebhookInfoResponseSchema = z.object({
	ok: z.literal(true),
	message: z.string(),
	method: z.literal("POST"),
	path: z.string(),
});

export type EmailWebhookInfoResponse = z.output<typeof EmailWebhookInfoResponseSchema>;

/** `POST /notifications/email-webhook` payload — the delivery event was accepted (Resend only checks the 200). */
export const EmailWebhookReceivedResponseSchema = z.object({
	received: z.literal(true),
});

export type EmailWebhookReceivedResponse = z.output<typeof EmailWebhookReceivedResponseSchema>;
