import { z } from "zod";

import { EpochMsSchema } from "../api/common";

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
export const EmailTemplateKeySchema = z.enum(["verification", "password-reset", "account-locked", "welcome", "security-alert", "admin-alert", "api-key-created"]);

export type EmailTemplateKey = z.output<typeof EmailTemplateKeySchema>;

// ── Template metadata (list view) ─────────────────────────────────────────

/** Static metadata for one template — used by the admin preview list. */
export const EmailTemplateMetaSchema = z
	.object({
		key: EmailTemplateKeySchema,
		label: z.string().min(1),
		description: z.string().min(1),
		sampleTo: z.email(),
	})
	.strict();

export type EmailTemplateMeta = z.output<typeof EmailTemplateMetaSchema>;

// ── Sample props (serialized for display) ────────────────────────────────

/** Serializable value allowed inside rendered sample props. */
export const EmailPreviewPropValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export type EmailPreviewPropValue = z.output<typeof EmailPreviewPropValueSchema>;

// ── Preview list response (admin index) ───────────────────────────────────

/** Envelope data for `GET /notifications/email-preview`. */
export const EmailPreviewListResponseSchema = z
	.object({
		templates: z.array(EmailTemplateMetaSchema),
	})
	.strict();

export type EmailPreviewListResponse = z.output<typeof EmailPreviewListResponseSchema>;

// ── Preview payload (single template) ─────────────────────────────────────

/**
 * Full preview for one template: the rendered HTML + plain text, plus the
 * subject / recipient / preview-text so the admin page can show everything
 * without ever constructing a template itself.
 */
export const EmailPreviewSchema = z
	.object({
		key: EmailTemplateKeySchema,
		label: z.string().min(1),
		description: z.string().min(1),
		subject: z.string().min(1),
		to: z.email(),
		previewText: z.string().min(1),
		html: z.string().min(1),
		text: z.string().min(1),
		props: z.record(z.string(), EmailPreviewPropValueSchema),
	})
	.strict();

export type EmailPreview = z.output<typeof EmailPreviewSchema>;

// ── Send result ───────────────────────────────────────────────────────────

/** Outcome of `EmailSenderService.send()`. Never throws — callers inspect this. */
export const EmailSendResultSchema = z.discriminatedUnion("ok", [
	z
		.object({
			ok: z.literal(true),
			id: z.string(),
			mode: z.enum(["send", "log-only", "noop"]),
		})
		.strict(),
	z
		.object({
			ok: z.literal(false),
			reason: z.enum(["invalid-props", "config", "timeout", "rate-limited", "api-error"]),
			detail: z.string().optional(),
		})
		.strict(),
]);

export type EmailSendResult = z.output<typeof EmailSendResultSchema>;

// ── Email log status (webhook updates) ────────────────────────────────────

/** Lifecycle of one outbound email, fed by the Resend webhook. */
export const EmailLogStatusSchema = z.enum(["sent", "delivered", "bounced", "complained", "failed"]);

export type EmailLogStatus = z.output<typeof EmailLogStatusSchema>;

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
		data: z
			.object({
				/** The Resend id of the outbound email this event is about. */
				email_id: z.string().min(1),
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
export const EmailLogEntrySchema = z
	.object({
		id: z.string().min(1),
		templateKey: EmailTemplateKeySchema,
		to: z.string().min(1),
		subject: z.string().min(1),
		status: EmailLogStatusSchema,
		resendId: z.string().nullable().optional(),
		error: z.string().nullable().optional(),
		createdAt: EpochMsSchema,
		updatedAt: EpochMsSchema,
	})
	.strict();

export type EmailLogEntry = z.output<typeof EmailLogEntrySchema>;

/** Envelope data for `GET /notifications/email-log`. */
export const EmailLogListResponseSchema = z
	.object({
		logs: z.array(EmailLogEntrySchema),
	})
	.strict();

export type EmailLogListResponse = z.output<typeof EmailLogListResponseSchema>;

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

/** Query string for `GET /notifications/email-log`. */
export const EmailLogListQuerySchema = z
	.object({
		limit: z
			.union([z.number().int().min(1).max(500), z.string().regex(/^\d+$/).transform((value: string): number => Number.parseInt(value, 10))])
			.optional()
			.default(100)
			.transform((value: number): number => Math.max(1, Math.min(value, 500))),
	})
	.strict();

export type EmailLogListQuery = z.output<typeof EmailLogListQuerySchema>;

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
