import { z } from "zod";

import { BaseResponseSchema, EpochMsSchema } from "../../../schemas/api/common";
import { defineListQuery, listFilter } from "../../../schemas/api/list-query";
import { WebhookEventTypeSchema, WebhookSubscribableEventTypeSchema } from "./outbound-webhook-events";

/**
 * Outgoing webhooks — the merchant console's contract (ADR 082): a tenant's endpoints, their signing
 * secrets (shown once), and the delivery log. Routes live under `/tenants/:tenantSlug/webhooks`.
 */

// ── Budgets (mirror the column sizes in prisma/schema.prisma) ───────────────

/** Longest endpoint URL (`WebhookEndpoint.url`). */
export const WEBHOOK_ENDPOINT_URL_MAX_LENGTH = 2048;
/** Longest endpoint description (`WebhookEndpoint.description`). */
export const WEBHOOK_ENDPOINT_DESCRIPTION_MAX_LENGTH = 200;
/** Most live endpoints one tenant may have (each event is sent to every subscribed one). */
export const MAX_WEBHOOK_ENDPOINTS_PER_TENANT = 10;
/** Longest error kept on a delivery (`WebhookDelivery.lastError`); a longer one is cut. */
export const WEBHOOK_DELIVERY_ERROR_MAX_LENGTH = 500;
/** Every signing secret starts with this, so a leaked one is recognisable in a scan. */
export const WEBHOOK_SECRET_PREFIX = "whsec_";

/** A signing secret: the `whsec_` prefix (a pattern, not `startsWith`, so the JSON Schema stays a plain `pattern` the API's validator knows). */
const WEBHOOK_SECRET_PATTERN = /^whsec_/;
/** Characters of the secret's end shown in the console to tell secrets apart. */
export const WEBHOOK_SECRET_HINT_LENGTH = 4;
/** How long the previous secret still signs after a rotation, unless asked otherwise. */
export const DEFAULT_WEBHOOK_SECRET_GRACE_HOURS = 24;
/** The longest grace a rotation may keep the previous secret for. */
export const MAX_WEBHOOK_SECRET_GRACE_HOURS = 72;
/** Delivery-log page size. */
export const WEBHOOK_DELIVERIES_PAGE_SIZE = 25;

// ── Enums (mirror the Prisma enums) ─────────────────────────────────────────

/** Mirrors the Prisma enum `WebhookEndpointStatus`. */
export const WebhookEndpointStatusSchema = z.enum(["ACTIVE", "DISABLED"]);
export type WebhookEndpointStatus = z.output<typeof WebhookEndpointStatusSchema>;

/**
 * Why an endpoint is disabled. Mirrors the Prisma enum `WebhookEndpointDisabledReason`.
 * - `MANUAL` — a member turned it off.
 * - `FAILING` — the platform turned it off after too many deliveries in a row gave up.
 */
export const WebhookEndpointDisabledReasonSchema = z.enum(["MANUAL", "FAILING"]);
export type WebhookEndpointDisabledReason = z.output<typeof WebhookEndpointDisabledReasonSchema>;

/**
 * Where a delivery is. Mirrors the Prisma enum `WebhookDeliveryStatus`.
 * - `PENDING` — waiting for its first attempt (or for a redelivery).
 * - `FAILED` — an attempt failed; another is scheduled at `nextAttemptAt`.
 * - `SUCCEEDED` — the endpoint answered 2xx.
 * - `DEAD` — every attempt failed; no more are made (a member can redeliver it).
 * - `CANCELLED` — the endpoint was disabled or removed before it could be delivered.
 */
export const WebhookDeliveryStatusSchema = z.enum(["PENDING", "FAILED", "SUCCEEDED", "DEAD", "CANCELLED"]);
export type WebhookDeliveryStatus = z.output<typeof WebhookDeliveryStatusSchema>;

// ── Endpoint inputs ─────────────────────────────────────────────────────────

/** An endpoint's address. Only the shape is checked here; the API also requires HTTPS and a public host (ADR 082). */
export const WebhookEndpointUrlSchema = z.url({ protocol: /^https?$/, error: "Enter an http(s) address" }).max(WEBHOOK_ENDPOINT_URL_MAX_LENGTH);

/** The types an endpoint receives: at least one, each once. */
export const WebhookEndpointEventTypesSchema = z
	.array(WebhookSubscribableEventTypeSchema)
	.min(1, { error: "Choose at least one event" })
	.max(WebhookSubscribableEventTypeSchema.options.length)
	.refine((types) => new Set(types).size === types.length, { error: "Each event can be chosen once" });

const WebhookEndpointDescriptionSchema = z.string().trim().max(WEBHOOK_ENDPOINT_DESCRIPTION_MAX_LENGTH);

/** `POST /tenants/:tenantSlug/webhooks/endpoints`. */
export const CreateWebhookEndpointSchema = z
	.object({
		url: WebhookEndpointUrlSchema,
		description: WebhookEndpointDescriptionSchema.default(""),
		eventTypes: WebhookEndpointEventTypesSchema,
	})
	.strict();
export type CreateWebhookEndpointInput = z.input<typeof CreateWebhookEndpointSchema>;
export type CreateWebhookEndpoint = z.output<typeof CreateWebhookEndpointSchema>;

/** `PATCH /tenants/:tenantSlug/webhooks/endpoints/:endpointId`: at least one field. */
export const UpdateWebhookEndpointSchema = z
	.object({
		url: WebhookEndpointUrlSchema.optional(),
		description: WebhookEndpointDescriptionSchema.optional(),
		eventTypes: WebhookEndpointEventTypesSchema.optional(),
	})
	.strict()
	.refine((input) => input.url !== undefined || input.description !== undefined || input.eventTypes !== undefined, { error: "Change at least one field" });
export type UpdateWebhookEndpointInput = z.input<typeof UpdateWebhookEndpointSchema>;
export type UpdateWebhookEndpoint = z.output<typeof UpdateWebhookEndpointSchema>;

/** `POST …/endpoints/:endpointId/rotate-secret`: how long the previous secret keeps signing (0 = stop now, e.g. after a leak). */
export const RotateWebhookSecretSchema = z
	.object({
		keepPreviousForHours: z.number().int().min(0).max(MAX_WEBHOOK_SECRET_GRACE_HOURS).default(DEFAULT_WEBHOOK_SECRET_GRACE_HOURS),
	})
	.strict();
export type RotateWebhookSecretInput = z.input<typeof RotateWebhookSecretSchema>;
export type RotateWebhookSecret = z.output<typeof RotateWebhookSecretSchema>;

export const WebhookEndpointIdParamsSchema = z.object({ endpointId: z.uuid() }).strict();
export type WebhookEndpointIdParams = z.output<typeof WebhookEndpointIdParamsSchema>;

export const WebhookDeliveryIdParamsSchema = z.object({ deliveryId: z.uuid() }).strict();
export type WebhookDeliveryIdParams = z.output<typeof WebhookDeliveryIdParamsSchema>;

// ── Endpoint responses ──────────────────────────────────────────────────────

/** An endpoint as its tenant sees it. The secret itself is never returned after create / rotate. */
export const WebhookEndpointSummarySchema = BaseResponseSchema.extend({
	id: z.uuid(),
	url: z.string().min(1).max(WEBHOOK_ENDPOINT_URL_MAX_LENGTH),
	description: z.string().max(WEBHOOK_ENDPOINT_DESCRIPTION_MAX_LENGTH),
	eventTypes: z.array(WebhookSubscribableEventTypeSchema),
	status: WebhookEndpointStatusSchema,
	disabledReason: WebhookEndpointDisabledReasonSchema.nullable(),
	disabledAt: EpochMsSchema.nullable(),
	/** The current secret's last characters ("…a1b2"), to tell secrets apart. */
	secretHint: z.string().length(WEBHOOK_SECRET_HINT_LENGTH),
	/** While set (and in the future), deliveries are also signed with the previous secret. */
	previousSecretExpiresAt: EpochMsSchema.nullable(),
	/** Deliveries in a row that gave up (reset by any success); at the threshold the endpoint turns itself off. */
	consecutiveFailures: z.number().int().nonnegative(),
	lastDeliveryAt: EpochMsSchema.nullable(),
	/** Optimistic-concurrency version: every change increments it. */
	version: z.number().int().nonnegative(),
});
export type WebhookEndpointSummary = z.output<typeof WebhookEndpointSummarySchema>;

/** Create and rotate answer with the endpoint and its new secret, shown this once. */
export const WebhookEndpointWithSecretSchema = z.object({
	endpoint: WebhookEndpointSummarySchema,
	secret: z.string().regex(WEBHOOK_SECRET_PATTERN),
});
export type WebhookEndpointWithSecret = z.output<typeof WebhookEndpointWithSecretSchema>;

/** `GET …/webhooks/endpoints` — a tenant has at most {@link MAX_WEBHOOK_ENDPOINTS_PER_TENANT}, so one page holds them all. */
export const webhookEndpointListQuery = defineListQuery({
	sortable: ["createdAt"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {
		status: listFilter.enumeration(WebhookEndpointStatusSchema, { eq: true }),
	},
	params: {},
	defaultLimit: MAX_WEBHOOK_ENDPOINTS_PER_TENANT,
});
export const WebhookEndpointListQuerySchema = webhookEndpointListQuery.schema;
export type WebhookEndpointListQuery = z.output<typeof WebhookEndpointListQuerySchema>;
export type WebhookEndpointListSortField = (typeof webhookEndpointListQuery.sortable)[number];

// ── Deliveries ──────────────────────────────────────────────────────────────

/** One delivery of one event to one endpoint, as the delivery log shows it. */
export const WebhookDeliverySummarySchema = z.object({
	/** Sent as `Webhook-Id`: stable across retries and redeliveries. */
	id: z.uuid(),
	endpointId: z.uuid(),
	endpointUrl: z.string().min(1).max(WEBHOOK_ENDPOINT_URL_MAX_LENGTH),
	eventId: z.uuid(),
	eventType: WebhookEventTypeSchema,
	status: WebhookDeliveryStatusSchema,
	attempts: z.number().int().nonnegative(),
	nextAttemptAt: EpochMsSchema.nullable(),
	lastAttemptAt: EpochMsSchema.nullable(),
	/** The endpoint's HTTP status on the last attempt; null when it never answered (timeout, refused, blocked). */
	lastStatusCode: z.number().int().nullable(),
	lastError: z.string().max(WEBHOOK_DELIVERY_ERROR_MAX_LENGTH).nullable(),
	lastDurationMs: z.number().int().nonnegative().nullable(),
	deliveredAt: EpochMsSchema.nullable(),
	createdAt: EpochMsSchema,
});
export type WebhookDeliverySummary = z.output<typeof WebhookDeliverySummarySchema>;

/** `GET …/webhooks/deliveries` — newest first, filterable by status, event type and endpoint. */
export const webhookDeliveryListQuery = defineListQuery({
	sortable: ["createdAt"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {
		status: listFilter.enumeration(WebhookDeliveryStatusSchema, { eq: true, in: true }),
		eventType: listFilter.enumeration(WebhookEventTypeSchema, { eq: true, in: true }),
		endpointId: listFilter.uuid({ eq: true }),
	},
	params: {},
	defaultLimit: WEBHOOK_DELIVERIES_PAGE_SIZE,
});
export const WebhookDeliveryListQuerySchema = webhookDeliveryListQuery.schema;
export type WebhookDeliveryListQuery = z.output<typeof WebhookDeliveryListQuerySchema>;
export type WebhookDeliveryListSortField = (typeof webhookDeliveryListQuery.sortable)[number];
