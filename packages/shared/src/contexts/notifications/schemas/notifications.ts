import { z } from "zod";

import { CLIENT_TYPE_QUERY_PARAM } from "../../../contracts/client-session";
import { BaseResponseSchema, EpochMsSchema } from "../../../schemas/api/common";
import { defineListQuery, listFilter } from "../../../schemas/api/list-query";
import { AuthClientTypeSchema } from "../../identity/schemas/auth";
import { IanaTimeZoneSchema } from "../../reporting/schemas/analytics-time-zone";
import { RichTextDocumentResponseSchema } from "./rich-text";

// ── Notifications (ADR 070): one catalog, four channels ──────────────────────────────────────────

export const NotificationChannelSchema = z.enum(["IN_APP", "EMAIL", "PUSH", "SMS"]);
export type NotificationChannel = z.output<typeof NotificationChannelSchema>;

/**
 * What preferences act on. `SECURITY` is always sent in-app and by email; `OPERATIONS` (the platform's own
 * alerts, to the admin panel's people only) always in-app and to their phones.
 */
export const NotificationCategorySchema = z.enum(["SECURITY", "ACCOUNT", "TRANSACTIONAL", "PRODUCT", "MARKETING", "OPERATIONS"]);
export type NotificationCategory = z.output<typeof NotificationCategorySchema>;

/** The audience side a notification belongs to; each app's bell shows only its own surface. */
export const NotificationSurfaceSchema = z.enum(["CUSTOMER", "MERCHANT", "ADMIN"]);
export type NotificationSurface = z.output<typeof NotificationSurfaceSchema>;

export const NotificationDeliveryStatusSchema = z.enum(["PENDING", "HELD", "QUEUED", "SENDING", "SENT", "DELIVERED", "FAILED", "SUPPRESSED"]);
export type NotificationDeliveryStatus = z.output<typeof NotificationDeliveryStatusSchema>;

export const NotificationDigestFrequencySchema = z.enum(["OFF", "DAILY", "WEEKLY"]);
export type NotificationDigestFrequency = z.output<typeof NotificationDigestFrequencySchema>;

export const PushPlatformSchema = z.enum(["IOS", "ANDROID"]);
export type PushPlatform = z.output<typeof PushPlatformSchema>;

export const MarketingConsentScopeSchema = z.enum(["PLATFORM", "TENANT"]);
export type MarketingConsentScope = z.output<typeof MarketingConsentScopeSchema>;

export const MarketingConsentSourceSchema = z.enum(["SIGNUP", "FIRST_CLAIM", "SETTINGS", "UNSUBSCRIBE_LINK", "LEAVE_TENANT"]);
export type MarketingConsentSource = z.output<typeof MarketingConsentSourceSchema>;

export const NotificationSuppressionCauseSchema = z.enum(["HARD_BOUNCE", "COMPLAINT", "SMS_STOP", "INVALID_NUMBER", "UNSUBSCRIBED"]);
export type NotificationSuppressionCause = z.output<typeof NotificationSuppressionCauseSchema>;

/** Why a delivery was not made, or is waiting. */
export const NotificationDeliveryReasonSchema = z.enum([
	"preference",
	"quiet-hours",
	"digest",
	"grouping",
	"cap",
	"no-device",
	"unverified-phone",
	"suppressed-destination",
	"provider-disabled",
	"recipient-deleted",
	"tenant-inactive",
	"no-consent",
	"impersonation",
	"surface",
	"country-not-allowed",
	/** Its broadcast was cancelled, or stopped after a report was upheld, before this recipient's turn (ADR 073). */
	"broadcast-stopped",
]);
export type NotificationDeliveryReason = z.output<typeof NotificationDeliveryReasonSchema>;

/** The wording version of the marketing-consent question a person answers (ADR 070). Bump it when the wording changes. */
export const MARKETING_CONSENT_WORDING_VERSION = "2026-10-30";

/** Minutes in a day: quiet hours are minutes after local midnight. */
export const MINUTES_PER_DAY = 1_440;
const LAST_MINUTE_OF_DAY = MINUTES_PER_DAY - 1;
export const MinuteOfDaySchema = z.number().int().min(0).max(LAST_MINUTE_OF_DAY);

/** Push devices one person may hold at once; registering one more revokes the oldest. */
export const MAX_PUSH_DEVICES_PER_USER = 10;

/** Notification titles and bodies, as stored. */
export const NOTIFICATION_TITLE_MAX_LENGTH = 200;
export const NOTIFICATION_LIST_DEFAULT_LIMIT = 20;
export const NOTIFICATION_LIST_MAX_IDS = 100;

// ── In-app inbox ─────────────────────────────────────────────────────────────────────────────────

export const InAppNotificationResponseSchema = BaseResponseSchema.extend({
	id: z.uuid(),
	typeKey: z.string(),
	category: NotificationCategorySchema,
	surface: NotificationSurfaceSchema,
	title: z.string(),
	body: z.string(),
	/** A broadcast's rich body (ADR 073); null for a catalog notification. */
	richBody: RichTextDocumentResponseSchema.nullable(),
	link: z.string().nullable(),
	icon: z.string().nullable(),
	senderName: z.string().nullable(),
	senderLogoUrl: z.string().nullable(),
	groupCount: z.number().int().positive(),
	broadcastId: z.uuid().nullable(),
	readAt: EpochMsSchema.nullable(),
	archivedAt: EpochMsSchema.nullable(),
});
export type InAppNotificationResponse = z.output<typeof InAppNotificationResponseSchema>;

/** `GET /notifications`: the caller's inbox on one surface — `filter[readAt][isNull]=true` lists the unread. */
export const inAppNotificationListQuery = defineListQuery({
	sortable: ["createdAt"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {
		readAt: listFilter.epochMs({ isNull: true, gte: true, lte: true }),
		archivedAt: listFilter.epochMs({ isNull: true, gte: true, lte: true }),
		category: listFilter.enumeration(NotificationCategorySchema, { eq: true, in: true }),
	},
	params: { surface: NotificationSurfaceSchema },
	defaultLimit: NOTIFICATION_LIST_DEFAULT_LIMIT,
});
export const InAppNotificationListQuerySchema = inAppNotificationListQuery.schema;
export type InAppNotificationListQuery = z.output<typeof InAppNotificationListQuerySchema>;

export const NotificationUnreadCountQuerySchema = z.object({ surface: NotificationSurfaceSchema }).strict();
export type NotificationUnreadCountQuery = z.output<typeof NotificationUnreadCountQuerySchema>;
/**
 * `GET /notifications/stream`: the surface, and the app the browser names in the query — `EventSource` cannot
 * send `X-Client-Type`, so the stream URL carries `client_type` to pick that app's session cookie.
 */
export const NotificationStreamQuerySchema = z.object({ surface: NotificationSurfaceSchema, [CLIENT_TYPE_QUERY_PARAM]: AuthClientTypeSchema.optional() }).strict();
export type NotificationStreamQuery = z.output<typeof NotificationStreamQuerySchema>;

export const NotificationUnreadCountResponseSchema = z.object({ unread: z.number().int().nonnegative() });
export type NotificationUnreadCountResponse = z.output<typeof NotificationUnreadCountResponseSchema>;

/** Mark some (by id) or all (on one surface) of the caller's notifications read. */
export const MarkNotificationsReadSchema = z
	.object({
		surface: NotificationSurfaceSchema,
		notificationIds: z.array(z.uuid()).min(1).max(NOTIFICATION_LIST_MAX_IDS).optional(),
		markAll: z.literal(true).optional(),
	})
	.strict()
	.refine((input): boolean => (input.notificationIds === undefined) !== (input.markAll === undefined), {
		message: "Send either notificationIds or markAll, not both",
	});
export type MarkNotificationsReadInput = z.output<typeof MarkNotificationsReadSchema>;

export const ArchiveNotificationsSchema = z.object({ notificationIds: z.array(z.uuid()).min(1).max(NOTIFICATION_LIST_MAX_IDS) }).strict();
export type ArchiveNotificationsInput = z.output<typeof ArchiveNotificationsSchema>;

/** One live-stream frame: something changed in the caller's inbox on that surface. */
export const InAppNotificationSignalSchema = z.object({ surface: NotificationSurfaceSchema, unread: z.number().int().nonnegative() });
export type InAppNotificationSignal = z.output<typeof InAppNotificationSignalSchema>;

// ── Preferences, quiet hours, digest ─────────────────────────────────────────────────────────────

/** Why a cell of the preference matrix cannot be changed or used. */
export const NotificationChannelUnavailableReasonSchema = z.enum(["mandatory", "phone-unverified", "no-push-device", "not-offered", "needs-consent"]);
export type NotificationChannelUnavailableReason = z.output<typeof NotificationChannelUnavailableReasonSchema>;

export const NotificationPreferenceCellSchema = z.object({
	channel: NotificationChannelSchema,
	enabled: z.boolean(),
	/** Cannot be turned off (a mandatory channel). */
	locked: z.boolean(),
	/** The person can receive on it at all. */
	available: z.boolean(),
	reason: NotificationChannelUnavailableReasonSchema.nullable(),
});
export type NotificationPreferenceCell = z.output<typeof NotificationPreferenceCellSchema>;

/** One kind of message and its channels. */
export const NotificationPreferenceRowSchema = z.object({ category: NotificationCategorySchema, channels: z.array(NotificationPreferenceCellSchema) });
export type NotificationPreferenceRow = z.output<typeof NotificationPreferenceRowSchema>;

/**
 * The Android notification channel each kind of message is posted on. The phone app creates these
 * channels, so a person can tune each kind in the phone's own settings; the API names one per push.
 */
export const NOTIFICATION_PUSH_CHANNEL_IDS: Readonly<Record<NotificationCategory, string>> = {
	SECURITY: "notifications-security",
	ACCOUNT: "notifications-account",
	TRANSACTIONAL: "notifications-activity",
	PRODUCT: "notifications-product",
	MARKETING: "notifications-offers",
	OPERATIONS: "notifications-operations",
};

/** What a settings switch shows: on or off and changeable, kept on by a mandatory channel, or not available yet. */
export type NotificationPreferenceCellState = "on" | "off" | "locked" | "unavailable";

export function preferenceCellStateOf(cell: NotificationPreferenceCell): NotificationPreferenceCellState {
	if (cell.locked) {
		return "locked";
	}
	if (!cell.available) {
		return "unavailable";
	}
	return cell.enabled ? "on" : "off";
}

/** Whether the channel reaches the person now: kept on, or on and available. */
export function isPreferenceCellOn(cell: NotificationPreferenceCell): boolean {
	return cell.locked || (cell.enabled && cell.available);
}

/** The channels worth a switch: a kind of message never sent on a channel shows none for it. */
export function shownPreferenceCellsOf(row: NotificationPreferenceRow): readonly NotificationPreferenceCell[] {
	return row.channels.filter((cell): boolean => cell.reason !== "not-offered");
}

/** What a kind's own checkbox shows: every channel that can reach the person is on, some are, or none is. */
export type NotificationKindCheckState = "all" | "some" | "none";

/** A kind's checkbox over its channels that can reach the person (kept on, or available); one not available yet is left out. */
export function kindCheckStateOf(row: NotificationPreferenceRow): NotificationKindCheckState {
	const reachable = shownPreferenceCellsOf(row).filter((cell): boolean => cell.locked || cell.available);
	const onCount = reachable.filter(isPreferenceCellOn).length;
	if (onCount === 0) {
		return "none";
	}
	return onCount === reachable.length ? "all" : "some";
}

/** The channels a kind's checkbox changes: shown, available, not kept on, and not already `enabled`. */
export function kindChannelChangesOf(row: NotificationPreferenceRow, enabled: boolean): readonly NotificationChannel[] {
	return shownPreferenceCellsOf(row)
		.filter((cell): boolean => !cell.locked && cell.available && cell.enabled !== enabled)
		.map((cell): NotificationChannel => cell.channel);
}

/** Whether a kind's checkbox can change anything: at least one of its shown channels is available and not kept on. */
export function isKindSwitchable(row: NotificationPreferenceRow): boolean {
	return shownPreferenceCellsOf(row).some((cell): boolean => !cell.locked && cell.available);
}

const NOTIFICATION_SCHEDULE_SHAPE = {
	quietHoursEnabled: z.boolean(),
	quietStartMinute: MinuteOfDaySchema,
	quietEndMinute: MinuteOfDaySchema,
	timeZone: IanaTimeZoneSchema,
	digestFrequency: NotificationDigestFrequencySchema,
};

/** Quiet hours and the digest, as a client sets them (closed). */
export const NotificationScheduleSchema = z.object(NOTIFICATION_SCHEDULE_SHAPE).strict();
export type NotificationSchedule = z.output<typeof NotificationScheduleSchema>;

/** One tenant the person is a tenant customer of: consent and leave controls (ADR 073). */
export const NotificationTenantSettingSchema = z.object({
	tenantId: z.uuid(),
	tenantName: z.string(),
	marketingConsent: z.boolean(),
	left: z.boolean(),
});
export type NotificationTenantSetting = z.output<typeof NotificationTenantSettingSchema>;

export const NotificationPreferencesResponseSchema = z.object({
	/** `null` = platform-wide; a tenant id = that tenant's overrides. */
	tenantId: z.uuid().nullable(),
	categories: z.array(NotificationPreferenceRowSchema),
	platformMarketingConsent: z.boolean(),
	schedule: z.object(NOTIFICATION_SCHEDULE_SHAPE),
	tenants: z.array(NotificationTenantSettingSchema),
});
export type NotificationPreferencesResponse = z.output<typeof NotificationPreferencesResponseSchema>;

export const NotificationPreferencesQuerySchema = z.object({ tenantId: z.uuid().optional() }).strict();
export type NotificationPreferencesQuery = z.output<typeof NotificationPreferencesQuerySchema>;

export const UpdateNotificationPreferencesSchema = z
	.object({
		tenantId: z.uuid().nullable(),
		changes: z
			.array(z.object({ category: NotificationCategorySchema, channel: NotificationChannelSchema, enabled: z.boolean() }).strict())
			.min(1)
			.max(NotificationCategorySchema.options.length * NotificationChannelSchema.options.length),
	})
	.strict();
export type UpdateNotificationPreferencesInput = z.output<typeof UpdateNotificationPreferencesSchema>;

export const SetMarketingConsentSchema = z
	.object({
		scope: MarketingConsentScopeSchema,
		tenantId: z.uuid().nullable(),
		granted: z.boolean(),
		wordingVersion: z.string().min(1).max(32),
		source: z.enum(["SIGNUP", "FIRST_CLAIM", "SETTINGS"]),
	})
	.strict()
	.refine((input): boolean => (input.scope === "TENANT") === (input.tenantId !== null), { message: "A tenant consent names its tenant; a platform consent names none" });
export type SetMarketingConsentInput = z.output<typeof SetMarketingConsentSchema>;

export const LeaveTenantSchema = z.object({ tenantId: z.uuid() }).strict();
export type LeaveTenantInput = z.output<typeof LeaveTenantSchema>;

// ── Push devices ─────────────────────────────────────────────────────────────────────────────────

/** FCM tokens are ~160 characters and APNs 64 hex; anything longer is not a device token. */
export const PUSH_TOKEN_MAX_LENGTH = 4_096;

export const RegisterPushDeviceSchema = z
	.object({
		token: z.string().min(1).max(PUSH_TOKEN_MAX_LENGTH),
		platform: PushPlatformSchema,
		surface: NotificationSurfaceSchema,
		deviceLabel: z.string().trim().min(1).max(120).nullable(),
		appVersion: z.string().trim().min(1).max(32).nullable(),
	})
	.strict();
export type RegisterPushDeviceInput = z.output<typeof RegisterPushDeviceSchema>;

export const PushDeviceResponseSchema = BaseResponseSchema.extend({
	id: z.uuid(),
	platform: PushPlatformSchema,
	surface: NotificationSurfaceSchema,
	deviceLabel: z.string().nullable(),
	appVersion: z.string().nullable(),
	lastSeenAt: EpochMsSchema,
	isCurrentSession: z.boolean(),
});
export type PushDeviceResponse = z.output<typeof PushDeviceResponseSchema>;

/** `GET /notifications/push-devices`. */
export const PushDeviceListResponseSchema = z.array(PushDeviceResponseSchema);

/** A push tap tells the API which delivery was opened (it marks the in-app copy read). */
export const PushOpenedSchema = z.object({ deliveryId: z.uuid() }).strict();
export type PushOpenedInput = z.output<typeof PushOpenedSchema>;

// ── Delivery log, catalog, suppressions, providers (admin / merchant) ───────────────────────────

export const NotificationDeliveryEntrySchema = BaseResponseSchema.extend({
	id: z.uuid(),
	notificationId: z.uuid(),
	typeKey: z.string(),
	channel: NotificationChannelSchema,
	status: NotificationDeliveryStatusSchema,
	reason: NotificationDeliveryReasonSchema.nullable(),
	tenantId: z.uuid().nullable(),
	recipientUserId: z.uuid().nullable(),
	maskedDestination: z.string().nullable(),
	attempts: z.number().int().nonnegative(),
	providerMessageId: z.string().nullable(),
	lastError: z.string().nullable(),
	heldUntil: EpochMsSchema.nullable(),
	sentAt: EpochMsSchema.nullable(),
	deliveredAt: EpochMsSchema.nullable(),
	openedAt: EpochMsSchema.nullable(),
});
export type NotificationDeliveryEntry = z.output<typeof NotificationDeliveryEntrySchema>;

export const notificationDeliveryListQuery = defineListQuery({
	sortable: ["createdAt"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {
		channel: listFilter.enumeration(NotificationChannelSchema, { eq: true, in: true }),
		status: listFilter.enumeration(NotificationDeliveryStatusSchema, { eq: true, in: true }),
		reason: listFilter.enumeration(NotificationDeliveryReasonSchema, { eq: true, in: true }),
		typeKey: listFilter.string({ eq: true }),
		tenantId: listFilter.uuid({ eq: true }),
		createdAt: listFilter.epochMs({ gte: true, lte: true }),
	},
	params: {},
	defaultLimit: NOTIFICATION_LIST_DEFAULT_LIMIT,
});
export const NotificationDeliveryListQuerySchema = notificationDeliveryListQuery.schema;
export type NotificationDeliveryListQuery = z.output<typeof NotificationDeliveryListQuerySchema>;

export const NotificationTypeSummarySchema = z.object({
	key: z.string(),
	description: z.string(),
	category: NotificationCategorySchema,
	surfaces: z.array(NotificationSurfaceSchema),
	channels: z.array(NotificationChannelSchema),
	mandatoryChannels: z.array(NotificationChannelSchema),
	urgency: z.enum(["immediate", "normal"]),
	sensitive: z.boolean(),
	groups: z.boolean(),
	digestible: z.boolean(),
	allowsContactRecipient: z.boolean(),
});
export type NotificationTypeSummary = z.output<typeof NotificationTypeSummarySchema>;

/** `GET /admin/notifications/catalog`: every notification type. */
export const NotificationCatalogResponseSchema = z.array(NotificationTypeSummarySchema);

export const NotificationTypePreviewSchema = z.object({
	key: z.string(),
	inApp: z.object({ title: z.string(), body: z.string(), link: z.string().nullable() }).nullable(),
	email: z.object({ subject: z.string(), html: z.string(), text: z.string() }).nullable(),
	push: z.object({ title: z.string(), body: z.string() }).nullable(),
	sms: z.object({ text: z.string(), segments: z.number().int().positive() }).nullable(),
});
export type NotificationTypePreview = z.output<typeof NotificationTypePreviewSchema>;

export const NotificationTypeKeyParamsSchema = z.object({ key: z.string().regex(/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/) }).strict();
export type NotificationTypeKeyParams = z.output<typeof NotificationTypeKeyParamsSchema>;

export const SendTestNotificationSchema = z.object({ typeKey: NotificationTypeKeyParamsSchema.shape.key }).strict();
export type SendTestNotificationInput = z.output<typeof SendTestNotificationSchema>;

export const NotificationSuppressionEntrySchema = BaseResponseSchema.extend({
	id: z.uuid(),
	channel: NotificationChannelSchema,
	maskedDestination: z.string(),
	cause: NotificationSuppressionCauseSchema,
	liftedAt: EpochMsSchema.nullable(),
	liftReason: z.string().nullable(),
});
export type NotificationSuppressionEntry = z.output<typeof NotificationSuppressionEntrySchema>;

export const notificationSuppressionListQuery = defineListQuery({
	sortable: ["createdAt"],
	defaultSort: [{ field: "createdAt", direction: "desc" }],
	filter: {
		channel: listFilter.enumeration(NotificationChannelSchema, { eq: true }),
		cause: listFilter.enumeration(NotificationSuppressionCauseSchema, { eq: true, in: true }),
		liftedAt: listFilter.epochMs({ isNull: true, gte: true, lte: true }),
	},
	params: {},
	defaultLimit: NOTIFICATION_LIST_DEFAULT_LIMIT,
});
export const NotificationSuppressionListQuerySchema = notificationSuppressionListQuery.schema;
export type NotificationSuppressionListQuery = z.output<typeof NotificationSuppressionListQuerySchema>;

export const LiftNotificationSuppressionSchema = z.object({ reason: z.string().trim().min(10).max(500) }).strict();
export type LiftNotificationSuppressionInput = z.output<typeof LiftNotificationSuppressionSchema>;

export const NotificationProviderStatusSchema = z.object({
	channel: NotificationChannelSchema,
	provider: z.string(),
	configured: z.boolean(),
	/** `true` when it delivers for real; `false` for a local sink or `none`. */
	live: z.boolean(),
	detail: z.string(),
});
export type NotificationProviderStatus = z.output<typeof NotificationProviderStatusSchema>;
export const NotificationProvidersResponseSchema = z.object({ providers: z.array(NotificationProviderStatusSchema) });
export type NotificationProvidersResponse = z.output<typeof NotificationProvidersResponseSchema>;

// ── One-click unsubscribe (RFC 8058) ─────────────────────────────────────────────────────────────

/** A signed unsubscribe token (the HMAC makes it unforgeable; it never expires). */
const UNSUBSCRIBE_TOKEN_MAX_LENGTH = 2_048;
const UnsubscribeTokenSchema = z.string().min(1).max(UNSUBSCRIBE_TOKEN_MAX_LENGTH);

/** RFC 8058 one-click: the token rides in the `List-Unsubscribe` URL. */
export const UnsubscribeQuerySchema = z.object({ token: UnsubscribeTokenSchema }).strict();

/** The web unsubscribe page's call: the token from its own URL, sent in the body. */
export const UnsubscribeBodySchema = z.object({ token: UnsubscribeTokenSchema }).strict();
export type UnsubscribeBody = z.output<typeof UnsubscribeBodySchema>;

/**
 * The RFC 8058 POST body (`List-Unsubscribe=One-Click`, form-encoded). Mail clients may add fields, so it
 * is open; the token in the query is what is checked.
 */
export const OneClickUnsubscribeBodySchema = z.record(z.string(), z.string());

/** A Twilio callback (form-encoded): every field a string, signed as a whole (`X-Twilio-Signature`). */
export const TwilioCallbackBodySchema = z.record(z.string(), z.string());

/** What a provider callback is answered with: it was received (Twilio accepts any 2xx). */
export const NotificationWebhookReceivedResponseSchema = z.object({ received: z.literal(true) });
export type NotificationWebhookReceivedResponse = z.output<typeof NotificationWebhookReceivedResponseSchema>;
export type UnsubscribeQuery = z.output<typeof UnsubscribeQuerySchema>;
export const UnsubscribeResponseSchema = z.object({ category: NotificationCategorySchema, channel: NotificationChannelSchema, tenantName: z.string().nullable() });
export type UnsubscribeResponse = z.output<typeof UnsubscribeResponseSchema>;
