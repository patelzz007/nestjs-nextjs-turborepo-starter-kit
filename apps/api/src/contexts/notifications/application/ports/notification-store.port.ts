import type {
	JsonObject,
	NotificationAttachment,
	NotificationAttachmentResponse,
	NotificationCategory,
	NotificationChannel,
	NotificationDeliveryReason,
	NotificationDeliveryStatus,
	NotificationDigestFrequency,
	NotificationSurface,
	PushPlatform,
	TenantLifecycleState,
} from "@workspace/shared";

import type { InAppRendering } from "../../domain/catalog/notification-type";
import type { StoredPreference } from "../../domain/policies/notification-rules";

export interface StoredNotification {
	readonly id: string;
	readonly recipientUserId: string | null;
	readonly contactAddress: string | null;
	readonly tenantId: string | null;
	readonly typeKey: string;
	readonly category: NotificationCategory;
	readonly payload: JsonObject;
	readonly locale: string;
	readonly broadcastId: string | null;
	readonly fannedOutAt: number | null;
	/** Not delivered before this instant (a broadcast at the recipient's local time); null = at once. */
	readonly notBefore: number | null;
	readonly createdAt: number;
	/** Its optional file: the stored snapshot the inbox row copies, and the addresses an email or a push uses. */
	readonly attachment: { readonly stored: NotificationAttachment; readonly links: NotificationAttachmentResponse } | null;
}

/** What the fan-out needs to know about a user recipient. */
export interface NotificationRecipientProfile {
	readonly userId: string;
	readonly fullName: string;
	readonly email: string;
	readonly emailVerified: boolean;
	readonly phone: string | null;
	readonly phoneVerified: boolean;
	readonly locale: string;
	readonly isDeleted: boolean;
	readonly isActive: boolean;
	/** The surfaces the person uses: customer always; merchant with a live membership; admin with admin access. */
	readonly surfaces: readonly NotificationSurface[];
	/** Tenants the person is staff of (never their tenant customer, ADR 073). */
	readonly memberTenantIds: readonly string[];
}

export interface StoredSchedule {
	readonly quietHoursEnabled: boolean;
	readonly quietStartMinute: number;
	readonly quietEndMinute: number;
	readonly timeZone: string;
	readonly digestFrequency: NotificationDigestFrequency;
}

export interface ActivePushDevice {
	readonly id: string;
	readonly platform: PushPlatform;
	readonly surface: NotificationSurface;
	readonly tokenCiphertext: string;
	/** The Firebase Installation ID, encrypted (Android, enhancement 5.3); null when unknown. */
	readonly installationIdCiphertext: string | null;
	readonly deviceLabel: string | null;
}

export interface NewDelivery {
	readonly id: string;
	readonly notificationId: string;
	readonly recipientUserId: string | null;
	readonly tenantId: string | null;
	readonly typeKey: string;
	readonly channel: NotificationChannel;
	readonly status: NotificationDeliveryStatus;
	readonly reason: NotificationDeliveryReason | null;
	readonly heldUntil: number | null;
	readonly maskedDestination: string | null;
	readonly pushDeviceId: string | null;
	readonly providerMessageId: string | null;
}

export interface NewInAppNotification {
	readonly id: string;
	readonly notificationId: string;
	readonly userId: string;
	readonly tenantId: string | null;
	readonly surface: NotificationSurface;
	readonly typeKey: string;
	readonly category: NotificationCategory;
	readonly rendering: InAppRendering;
	readonly richBody: JsonObject | null;
	readonly senderName: string | null;
	readonly senderLogoUrl: string | null;
	readonly attachment: NotificationAttachment | null;
	readonly groupKey: string | null;
	readonly broadcastId: string | null;
}

export interface GroupedInApp {
	readonly id: string;
	readonly surface: NotificationSurface;
	readonly groupCount: number;
}

export interface StoredDelivery {
	readonly id: string;
	readonly notificationId: string;
	readonly channel: NotificationChannel;
	readonly status: NotificationDeliveryStatus;
	readonly reason: NotificationDeliveryReason | null;
	readonly attempts: number;
	readonly pushDeviceId: string | null;
	readonly recipientUserId: string | null;
	readonly tenantId: string | null;
	readonly typeKey: string;
}

/** What a broadcast notification shows: its rich body and who it is from (ADR 073). */
export interface BroadcastContent {
	readonly richBody: JsonObject;
	readonly senderName: string;
	readonly senderLogoUrl: string | null;
	/** Cancelled or stopped: what has not been delivered yet never is. */
	readonly stopped: boolean;
}

export interface DueDigestDelivery {
	readonly deliveryId: string;
	readonly userId: string;
	readonly email: string;
	readonly notification: StoredNotification;
	readonly digestFrequency: NotificationDigestFrequency;
}

export interface TenantStanding {
	readonly lifecycleState: TenantLifecycleState;
	readonly displayName: string;
	readonly logoUrl: string | null;
	readonly broadcastsDisabledAt: number | null;
}

/**
 * Everything the fan-out and the delivery workers read and write, on ONE transaction under a
 * `notifications.*` system operation. Recipient data is read as a read model (users, memberships,
 * tenants), never written.
 */
export interface NotificationStore {
	findNotification(notificationId: string): Promise<StoredNotification | null>;
	/** Conditional: only one fan-out ever wins a notification. */
	claimForFanOut(notificationId: string, now: number): Promise<boolean>;
	recipientProfile(userId: string): Promise<NotificationRecipientProfile | null>;
	tenantStanding(tenantId: string): Promise<TenantStanding | null>;
	preferences(userId: string): Promise<readonly StoredPreference[]>;
	schedule(userId: string): Promise<StoredSchedule | null>;
	/** The latest consent event decides; `tenantId` null = the platform's own marketing. */
	hasMarketingConsent(userId: string, tenantId: string | null): Promise<boolean>;
	/** Tenant customer who left (or is banned) never hears from that tenant's broadcasts. */
	hasLeftTenant(userId: string, tenantId: string): Promise<boolean>;
	isSuppressed(channel: NotificationChannel, destinationHash: string): Promise<boolean>;
	activePushDevices(userId: string): Promise<readonly ActivePushDevice[]>;
	findPushDevice(deviceId: string): Promise<(ActivePushDevice & { readonly userId: string; readonly revokedAt: number | null }) | null>;
	revokePushDevice(deviceId: string, reason: string, now: number): Promise<void>;
	findGroupedInApp(userId: string, typeKey: string, groupKey: string, since: number): Promise<readonly GroupedInApp[]>;
	updateGroupedInApp(inAppId: string, groupCount: number, rendering: InAppRendering, now: number): Promise<void>;
	insertInApp(rows: readonly NewInAppNotification[]): Promise<void>;
	insertDeliveries(rows: readonly NewDelivery[]): Promise<void>;
	findDelivery(deliveryId: string): Promise<StoredDelivery | null>;
	/** QUEUED → SENDING (or HELD → QUEUED when releasing); false when another worker moved it first. */
	transitionDelivery(deliveryId: string, from: NotificationDeliveryStatus, to: NotificationDeliveryStatus, now: number): Promise<boolean>;
	completeDelivery(
		deliveryId: string,
		outcome: {
			readonly status: NotificationDeliveryStatus;
			readonly reason: NotificationDeliveryReason | null;
			readonly providerMessageId: string | null;
			readonly error: string | null;
		},
		now: number,
	): Promise<void>;
	/** Empties a sensitive notification's payload once none of its deliveries can still need it. */
	scrubPayloadWhenDone(notificationId: string, now: number): Promise<void>;
	unreadCount(userId: string, surface: NotificationSurface): Promise<number>;
	/** A broadcast's body and sender; the platform's own broadcasts are sent as `platformName`. */
	broadcastContent(broadcastId: string): Promise<BroadcastContent | null>;
	/** Push and SMS deliveries released from HELD (quiet hours over) or left QUEUED by a crash. */
	dueDeliveries(now: number, limit: number): Promise<readonly { readonly id: string; readonly channel: NotificationChannel; readonly status: NotificationDeliveryStatus }[]>;
	/** Email deliveries held for a digest whose moment has come, oldest first. */
	dueDigestDeliveries(now: number, limit: number): Promise<readonly DueDigestDelivery[]>;
	/** The digest email went (or could not): every delivery it covered gets the outcome. */
	completeDigest(
		deliveryIds: readonly string[],
		outcome: { readonly status: NotificationDeliveryStatus; readonly providerMessageId: string | null },
		now: number,
	): Promise<void>;
	/** Retention, soft-deleting: inbox rows, deliveries and notifications after the record retention (ten years, platform/domain/record-retention.ts). */
	applyRetention(now: number): Promise<{ readonly inApp: number; readonly deliveries: number; readonly notifications: number }>;
	/** Devices whose session ended (signed out, revoked) stop receiving push (ADR 070). */
	revokeDevicesOfEndedSessions(now: number): Promise<number>;
	/** Notifications whose fan-out never ran (a crash between commit and hand-off). */
	/** Notifications still waiting for their fan-out: created before `olderThan` and due by `now`. */
	unfannedNotifications(olderThan: number, now: number, limit: number): Promise<readonly string[]>;
}
