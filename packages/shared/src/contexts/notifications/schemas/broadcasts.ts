import { z } from "zod";

import { BaseResponseSchema, EpochMsSchema } from "../../../schemas/api/common";
import { defineListQuery, listFilter, ListSearchSchema } from "../../../schemas/api/list-query";
import { BooleanQueryParamSchema } from "../../../schemas/api/query-params";
import { NotificationCategorySchema, NotificationChannelSchema, NotificationDeliveryReasonSchema } from "./notifications";
import { RichTextDocumentResponseSchema, RichTextDocumentSchema } from "./rich-text";

// ── Broadcasts and tenant customers (ADR 073) ────────────────────────────────────────────────────

export const BroadcastStatusSchema = z.enum(["DRAFT", "PENDING_APPROVAL", "SCHEDULED", "SENDING", "SENT", "CANCELLED", "PAUSED", "FAILED"]);
export type BroadcastStatus = z.output<typeof BroadcastStatusSchema>;

export const BroadcastSendModeSchema = z.enum(["INSTANT", "RECIPIENT_LOCAL_TIME"]);
export type BroadcastSendMode = z.output<typeof BroadcastSendModeSchema>;

export const BroadcastReportReasonSchema = z.enum(["SPAM", "OFFENSIVE", "SCAM"]);
export type BroadcastReportReason = z.output<typeof BroadcastReportReasonSchema>;

export const BroadcastReportStatusSchema = z.enum(["OPEN", "DISMISSED", "UPHELD"]);
export type BroadcastReportStatus = z.output<typeof BroadcastReportStatusSchema>;

/** Broadcasts never go by SMS (cost per message, and the channel most abused for spam). */
export const BroadcastChannelSchema = NotificationChannelSchema.extract(["IN_APP", "EMAIL", "PUSH"]);
export type BroadcastChannel = z.output<typeof BroadcastChannelSchema>;

/** A tenant broadcast is marketing; platform staff choose product or account notices. */
export const PlatformBroadcastCategorySchema = NotificationCategorySchema.extract(["PRODUCT", "ACCOUNT"]);

/** Tenant broadcasts per tenant per ISO week (counted in the week sending starts); a tenant override can raise it. */
export const TENANT_BROADCASTS_PER_WEEK = 5;
/** Reports that pause a broadcast: this many, or this share of its audience, whichever comes first. */
export const BROADCAST_REPORT_PAUSE_COUNT = 10;
export const BROADCAST_REPORT_PAUSE_SHARE = 0.01;
/** Upheld strikes within the window that turn a tenant's broadcasting off. */
export const BROADCAST_STRIKES_TO_DISABLE = 3;
export const BROADCAST_STRIKE_WINDOW_DAYS = 90;

/** "Claimed within N days": default 60, adjustable 7–365. */
export const BROADCAST_CLAIMED_WITHIN_DEFAULT_DAYS = 60;
export const BROADCAST_CLAIMED_WITHIN_MIN_DAYS = 7;
export const BROADCAST_CLAIMED_WITHIN_MAX_DAYS = 365;

export const BROADCAST_TITLE_MAX_LENGTH = 200;
/** People a tenant may pick by hand for one broadcast; beyond that, filters reach them. */
export const BROADCAST_MAX_CHOSEN_CUSTOMERS = 500;

const TENANT_AUDIENCE_SHAPE = {
	kind: z.literal("tenant-customers"),
	claimedWithinDays: z.number().int().min(BROADCAST_CLAIMED_WITHIN_MIN_DAYS).max(BROADCAST_CLAIMED_WITHIN_MAX_DAYS).default(BROADCAST_CLAIMED_WITHIN_DEFAULT_DAYS),
	redeemed: z.enum(["any", "redeemed", "not-redeemed"]).default("any"),
	locationId: z.uuid().nullable().default(null),
	/**
	 * Who exactly: null = every customer the filters match; a list = only these people (one person, or a
	 * group the sender picked). Either way only the tenant's customers who may hear from it receive it.
	 */
	customerIds: z.array(z.uuid()).min(1).max(BROADCAST_MAX_CHOSEN_CUSTOMERS).nullable().default(null),
};

const PLATFORM_AUDIENCE_SHAPE = {
	kind: z.literal("platform-users"),
	surfaces: z.array(z.enum(["CUSTOMER", "MERCHANT", "ADMIN"])).min(1),
	signedUpAfter: EpochMsSchema.nullable().default(null),
	/** Only members of tenants in these lifecycle states (merchant surface). */
	tenantStates: z
		.array(z.enum(["ACTIVE", "RESTRICTED"]))
		.nullable()
		.default(null),
};

/** Who a tenant's broadcast goes to (request: closed). */
export const TenantBroadcastAudienceSchema = z.object(TENANT_AUDIENCE_SHAPE).strict();
export type TenantBroadcastAudience = z.output<typeof TenantBroadcastAudienceSchema>;

/** Who a platform broadcast goes to (request: closed). */
export const PlatformBroadcastAudienceSchema = z.object(PLATFORM_AUDIENCE_SHAPE).strict();
export type PlatformBroadcastAudience = z.output<typeof PlatformBroadcastAudienceSchema>;

export const BroadcastAudienceSchema = z.discriminatedUnion("kind", [TenantBroadcastAudienceSchema, PlatformBroadcastAudienceSchema]);

/** The same audiences as the API answers them: open (ADR 022). */
export const BroadcastAudienceResponseSchema = z.discriminatedUnion("kind", [z.object(TENANT_AUDIENCE_SHAPE), z.object(PLATFORM_AUDIENCE_SHAPE)]);
export type BroadcastAudience = z.output<typeof BroadcastAudienceSchema>;

export const BroadcastDraftSchema = z
	.object({
		title: z.string().trim().min(1).max(BROADCAST_TITLE_MAX_LENGTH),
		body: RichTextDocumentSchema,
		audience: BroadcastAudienceSchema,
		channels: z.array(BroadcastChannelSchema).min(1).max(BroadcastChannelSchema.options.length),
		category: NotificationCategorySchema.extract(["MARKETING", "PRODUCT", "ACCOUNT"]),
		sendMode: BroadcastSendModeSchema,
		/** INSTANT: when to send (null = as soon as scheduled). */
		sendAt: EpochMsSchema.nullable(),
		/**
		 * RECIPIENT_LOCAL_TIME: the wall-clock date and time every recipient gets it at in their OWN time zone,
		 * written as if it were UTC (a floating time: 09:00 on 3 Nov = `Date.UTC(2026, 10, 3, 9)`). Each
		 * recipient's instant is `instantOfWallClock(localSendAt, theirTimeZone)`.
		 */
		localSendAt: EpochMsSchema.nullable(),
	})
	.strict()
	.refine((draft): boolean => (draft.sendMode === "RECIPIENT_LOCAL_TIME") === (draft.localSendAt !== null), {
		message: "A local-time broadcast names its local date and time; an instant one does not",
		path: ["localSendAt"],
	})
	.refine((draft): boolean => new Set(draft.channels).size === draft.channels.length, { message: "List each channel once", path: ["channels"] });
export type BroadcastDraftInput = z.output<typeof BroadcastDraftSchema>;

export const BroadcastResultsSchema = z.object({
	channel: BroadcastChannelSchema,
	targeted: z.number().int().nonnegative(),
	delivered: z.number().int().nonnegative(),
	failed: z.number().int().nonnegative(),
	suppressed: z.array(z.object({ reason: NotificationDeliveryReasonSchema, count: z.number().int().nonnegative() })),
	/** Push taps (push) or in-app reads (in-app); email opens are never tracked. */
	engaged: z.number().int().nonnegative().nullable(),
});
export type BroadcastResults = z.output<typeof BroadcastResultsSchema>;

export const BroadcastResponseSchema = BaseResponseSchema.extend({
	id: z.uuid(),
	tenantId: z.uuid().nullable(),
	status: BroadcastStatusSchema,
	title: z.string(),
	body: RichTextDocumentResponseSchema,
	audience: BroadcastAudienceResponseSchema,
	channels: z.array(BroadcastChannelSchema),
	category: NotificationCategorySchema,
	sendMode: BroadcastSendModeSchema,
	sendAt: EpochMsSchema.nullable(),
	/** RECIPIENT_LOCAL_TIME: the floating wall-clock send time (see `BroadcastDraftSchema.localSendAt`). */
	localSendAt: EpochMsSchema.nullable(),
	audienceCount: z.number().int().nonnegative().nullable(),
	authorUserId: z.uuid(),
	approverUserId: z.uuid().nullable(),
	sendingStartedAt: EpochMsSchema.nullable(),
	completedAt: EpochMsSchema.nullable(),
	cancelledAt: EpochMsSchema.nullable(),
	pausedAt: EpochMsSchema.nullable(),
	pauseReason: z.string().nullable(),
	results: z.array(BroadcastResultsSchema),
	openReports: z.number().int().nonnegative(),
});
export type BroadcastResponse = z.output<typeof BroadcastResponseSchema>;

export const broadcastListQuery = defineListQuery({
	sortable: ["createdAt"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {
		status: listFilter.enumeration(BroadcastStatusSchema, { eq: true, in: true }),
		tenantId: listFilter.uuid({ eq: true }),
	},
	params: {},
	defaultLimit: 20,
});
export const BroadcastListQuerySchema = broadcastListQuery.schema;
export type BroadcastListQuery = z.output<typeof BroadcastListQuerySchema>;

export const BroadcastIdParamsSchema = z.object({ broadcastId: z.uuid() }).strict();
export type BroadcastIdParams = z.output<typeof BroadcastIdParamsSchema>;

/** The live audience count while the sender edits the filters, with the people left out per reason (never names). */
export const BroadcastAudiencePreviewSchema = z.object({
	eligible: z.number().int().nonnegative(),
	linked: z.number().int().nonnegative(),
	leftOut: z.array(z.object({ reason: z.enum(["no-consent", "banned", "left", "staff", "deleted"]), count: z.number().int().nonnegative() })),
});
export type BroadcastAudiencePreview = z.output<typeof BroadcastAudiencePreviewSchema>;

export const BroadcastWeeklyAllowanceSchema = z.object({ used: z.number().int().nonnegative(), limit: z.number().int().positive(), broadcastingEnabled: z.boolean() });
export type BroadcastWeeklyAllowance = z.output<typeof BroadcastWeeklyAllowanceSchema>;

/** A link check failure names the exact link. */
export const BroadcastLinkProblemSchema = z.object({ href: z.string(), problem: z.enum(["not-https", "shortener", "blocked-domain"]) });
export type BroadcastLinkProblem = z.output<typeof BroadcastLinkProblemSchema>;

export const ReportBroadcastSchema = z.object({ reason: BroadcastReportReasonSchema, note: z.string().trim().max(500).nullable() }).strict();
export type ReportBroadcastInput = z.output<typeof ReportBroadcastSchema>;

export const BroadcastReportEntrySchema = BaseResponseSchema.extend({
	id: z.uuid(),
	broadcastId: z.uuid(),
	broadcastTitle: z.string(),
	tenantId: z.uuid().nullable(),
	tenantName: z.string().nullable(),
	reason: BroadcastReportReasonSchema,
	note: z.string().nullable(),
	status: BroadcastReportStatusSchema,
	reviewedAt: EpochMsSchema.nullable(),
	tenantStrikesInWindow: z.number().int().nonnegative(),
});
export type BroadcastReportEntry = z.output<typeof BroadcastReportEntrySchema>;

export const broadcastReportListQuery = defineListQuery({
	sortable: ["createdAt"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: { status: listFilter.enumeration(BroadcastReportStatusSchema, { eq: true, in: true }) },
	params: {},
	defaultLimit: 20,
});
export const BroadcastReportListQuerySchema = broadcastReportListQuery.schema;
export type BroadcastReportListQuery = z.output<typeof BroadcastReportListQuerySchema>;

export const ReviewBroadcastReportSchema = z.object({ decision: z.enum(["dismiss", "uphold", "resume"]), note: z.string().trim().max(500).nullable() }).strict();
export type ReviewBroadcastReportInput = z.output<typeof ReviewBroadcastReportSchema>;

// ── A tenant's customers, to pick recipients by hand ─────────────────────────────────────────────────

/** Why a customer cannot receive this tenant's broadcasts right now. */
export const TenantCustomerUnreachableReasonSchema = z.enum(["no-consent", "banned", "left", "staff"]);
export type TenantCustomerUnreachableReason = z.output<typeof TenantCustomerUnreachableReasonSchema>;

/**
 * One customer as the tenant sees them: a name and a masked email (`j•••@gmail.com`), never the full
 * address or phone, plus the claim history that made them a customer (ADR 073).
 */
export const TenantCustomerEntrySchema = z.object({
	userId: z.uuid(),
	fullName: z.string(),
	maskedEmail: z.string().nullable(),
	firstClaimedAt: EpochMsSchema,
	lastClaimedAt: EpochMsSchema,
	claimCount: z.number().int().positive(),
	lastRedeemedAt: EpochMsSchema.nullable(),
	/** null = this customer receives the tenant's broadcasts. */
	unreachableReason: TenantCustomerUnreachableReasonSchema.nullable(),
});
export type TenantCustomerEntry = z.output<typeof TenantCustomerEntrySchema>;

/** `GET /tenants/:tenantSlug/broadcasts/customers`: newest claim first; `search` matches the name or email. */
export const tenantCustomerListQuery = defineListQuery({
	sortable: ["lastClaimedAt", "firstClaimedAt", "claimCount"],
	defaultSort: [{ field: "lastClaimedAt", direction: "desc" }],
	filter: { lastClaimedAt: listFilter.epochMs({ gte: true, lte: true }) },
	params: { search: ListSearchSchema, reachableOnly: BooleanQueryParamSchema },
	defaultLimit: 20,
});
export const TenantCustomerListQuerySchema = tenantCustomerListQuery.schema;
export type TenantCustomerListQuery = z.output<typeof TenantCustomerListQuerySchema>;
