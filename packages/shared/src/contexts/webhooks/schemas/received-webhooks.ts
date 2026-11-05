import { z } from "zod";

import { EpochMsSchema } from "../../../schemas/api/common";
import { defineListQuery, listFilter, ListSearchSchema } from "../../../schemas/api/list-query";

/**
 * Received webhooks — the admin viewer's contract (`GET /admin/webhooks/received`,
 * `GET /admin/webhooks/received/:id`, ADR 081). One row per request a provider
 * (GitHub, Resend, Billplz, CHIP, the fake gateway, Twilio) sent this server,
 * verified or not, with what its signature check said and what it came to. No
 * payload is kept: its SHA-256 and size, and an allowlist of non-secret headers.
 * `correlationId` joins a row to its request in the HTTP audit trail.
 */

// ── Enums (mirror the Prisma enums) ─────────────────────────────────────────

/** Who sent it. Mirrors the Prisma enum `ReceivedWebhookProvider`. */
export const ReceivedWebhookProviderSchema = z.enum(["GITHUB", "RESEND", "BILLPLZ", "CHIP", "FAKE_PAYMENTS", "TWILIO"]);
export type ReceivedWebhookProvider = z.output<typeof ReceivedWebhookProviderSchema>;

/** What the signature check said. Mirrors the Prisma enum `ReceivedWebhookVerification`. */
export const ReceivedWebhookVerificationSchema = z.enum(["VALID", "INVALID", "MISSING", "NOT_CONFIGURED"]);
export type ReceivedWebhookVerification = z.output<typeof ReceivedWebhookVerificationSchema>;

/** What it came to. Mirrors the Prisma enum `ReceivedWebhookOutcome`. */
export const ReceivedWebhookOutcomeSchema = z.enum(["PROCESSING", "RECORDED", "DUPLICATE", "IGNORED", "REJECTED", "FAILED"]);
export type ReceivedWebhookOutcome = z.output<typeof ReceivedWebhookOutcomeSchema>;

// ── Budgets (mirror the column sizes in prisma/schema.prisma) ───────────────

/** Longest delivery id kept (`ReceivedWebhook.providerDeliveryId`). */
export const RECEIVED_WEBHOOK_DELIVERY_ID_MAX_LENGTH = 255;
/** Longest event name kept (`ReceivedWebhook.eventType`). */
export const RECEIVED_WEBHOOK_EVENT_TYPE_MAX_LENGTH = 100;
/** Longest error summary kept (`ReceivedWebhook.errorSummary`). */
export const RECEIVED_WEBHOOK_ERROR_SUMMARY_MAX_LENGTH = 500;
/** Longest header value kept; a longer one is cut. */
export const RECEIVED_WEBHOOK_HEADER_VALUE_MAX_LENGTH = 512;
/** Hex SHA-256 is 64 characters. */
const SHA256_HEX_LENGTH = 64;

// ── Rows ────────────────────────────────────────────────────────────────────

/** One received webhook in the list. */
export const ReceivedWebhookSummarySchema = z.object({
	id: z.uuid(),
	provider: ReceivedWebhookProviderSchema,
	providerDeliveryId: z.string().min(1).max(RECEIVED_WEBHOOK_DELIVERY_ID_MAX_LENGTH).nullable(),
	eventType: z.string().min(1).max(RECEIVED_WEBHOOK_EVENT_TYPE_MAX_LENGTH).nullable(),
	verification: ReceivedWebhookVerificationSchema,
	outcome: ReceivedWebhookOutcomeSchema,
	/** The HTTP status answered; null while the owning context is still processing it. */
	httpStatus: z.number().int().nullable(),
	attempts: z.number().int().nonnegative(),
	duplicateCount: z.number().int().nonnegative(),
	receivedAt: EpochMsSchema,
	lastReceivedAt: EpochMsSchema,
	completedAt: EpochMsSchema.nullable(),
	correlationId: z.string().min(1).nullable(),
});
export type ReceivedWebhookSummary = z.output<typeof ReceivedWebhookSummarySchema>;

/** The allowlisted request headers kept with a delivery (no signature, authorization or cookie). */
export const ReceivedWebhookHeadersSchema = z.record(z.string().min(1), z.string().max(RECEIVED_WEBHOOK_HEADER_VALUE_MAX_LENGTH));
export type ReceivedWebhookHeaders = z.output<typeof ReceivedWebhookHeadersSchema>;

/** One received webhook, complete. */
export const ReceivedWebhookDetailSchema = ReceivedWebhookSummarySchema.extend({
	payloadSha256: z.string().length(SHA256_HEX_LENGTH),
	payloadBytes: z.number().int().nonnegative(),
	headers: ReceivedWebhookHeadersSchema,
	errorSummary: z.string().min(1).max(RECEIVED_WEBHOOK_ERROR_SUMMARY_MAX_LENGTH).nullable(),
	claimedAt: EpochMsSchema.nullable(),
});
export type ReceivedWebhookDetail = z.output<typeof ReceivedWebhookDetailSchema>;

// ── Queries ─────────────────────────────────────────────────────────────────

/** `GET /admin/webhooks/received/:id`. */
export const ReceivedWebhookIdParamSchema = z.object({ id: z.uuid() }).strict();
export type ReceivedWebhookIdParam = z.output<typeof ReceivedWebhookIdParamSchema>;

/** `GET /admin/webhooks/received` (newest first) — see docs/technical/api/list-queries.md. `search` matches the delivery id, event and correlation id. */
export const receivedWebhookListQuery = defineListQuery({
	sortable: ["receivedAt"],
	defaultSort: [{ field: "receivedAt", direction: "desc" }],
	filter: {
		provider: listFilter.enumeration(ReceivedWebhookProviderSchema, { eq: true, in: true }),
		outcome: listFilter.enumeration(ReceivedWebhookOutcomeSchema, { eq: true, in: true }),
		verification: listFilter.enumeration(ReceivedWebhookVerificationSchema, { eq: true, in: true }),
		receivedAt: listFilter.epochMs({ gte: true, lte: true }),
	},
	params: { search: ListSearchSchema },
});
export const ReceivedWebhookListQuerySchema = receivedWebhookListQuery.schema;
export type ReceivedWebhookListQuery = z.output<typeof ReceivedWebhookListQuerySchema>;
export type ReceivedWebhookListSortField = (typeof receivedWebhookListQuery.sortable)[number];
