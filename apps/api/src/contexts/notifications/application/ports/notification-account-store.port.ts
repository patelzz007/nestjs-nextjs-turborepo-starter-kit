import type {
	InAppNotificationListQuery,
	InAppNotificationResponse,
	MarketingConsentScope,
	MarketingConsentSource,
	NotificationCategory,
	NotificationChannel,
	NotificationDeliveryEntry,
	NotificationDeliveryListQuery,
	NotificationSuppressionCause,
	NotificationSuppressionEntry,
	NotificationSuppressionListQuery,
	NotificationSurface,
	PaginatedServiceResult,
	PushDeviceResponse,
	PushPlatform,
} from "@workspace/shared";

import type { StoredPreference } from "../../domain/policies/notification-rules";
import type { ActivePushDevice, StoredSchedule } from "./notification-store.port";

export interface ConsentRecord {
	readonly userId: string;
	readonly scope: MarketingConsentScope;
	readonly tenantId: string | null;
	readonly granted: boolean;
	readonly source: MarketingConsentSource;
	readonly wordingVersion: string;
	readonly ip: string | null;
	readonly userAgent: string | null;
}

export interface TenantLink {
	readonly tenantId: string;
	readonly tenantName: string;
	readonly leftAt: number | null;
}

export interface NewPushDevice {
	readonly id: string;
	readonly userId: string;
	readonly deviceSessionId: string;
	readonly platform: PushPlatform;
	readonly surface: NotificationSurface;
	readonly tokenCiphertext: string;
	readonly tokenHash: string;
	readonly deviceLabel: string | null;
	readonly appVersion: string | null;
}

/** The person's own notification data and the admin readers (ADR 070), on one transaction. */
export interface NotificationAccountStore {
	listInbox(userId: string, query: InAppNotificationListQuery): Promise<PaginatedServiceResult<InAppNotificationResponse>>;
	/** Marks the person's rows read on `surface` (ids, or all); returns the notifications they belong to. */
	markRead(userId: string, surface: NotificationSurface, selection: readonly string[] | "all", now: number): Promise<readonly string[]>;
	/** Read sync across surfaces: every inbox row of these notifications is marked read too. */
	markNotificationsRead(userId: string, notificationIds: readonly string[], now: number): Promise<void>;
	archive(userId: string, inAppIds: readonly string[], now: number): Promise<void>;
	/** A push tap: the delivery is opened and its notification's inbox rows read; null when it is not the person's. */
	markPushOpened(userId: string, deliveryId: string, now: number): Promise<string | null>;
	unreadCount(userId: string, surface: NotificationSurface): Promise<number>;

	preferences(userId: string): Promise<readonly StoredPreference[]>;
	savePreferences(
		userId: string,
		tenantKey: string,
		changes: readonly { readonly category: NotificationCategory; readonly channel: NotificationChannel; readonly enabled: boolean }[],
		now: number,
	): Promise<void>;
	schedule(userId: string): Promise<StoredSchedule | null>;
	saveSchedule(userId: string, schedule: StoredSchedule, now: number): Promise<void>;
	/** The latest decision per scope: `platform` and each tenant id. */
	latestConsents(userId: string): Promise<ReadonlyMap<string, boolean>>;
	recordConsent(record: ConsentRecord, now: number): Promise<void>;
	tenantLinks(userId: string): Promise<readonly TenantLink[]>;
	leaveTenant(userId: string, tenantId: string, now: number): Promise<boolean>;
	phoneVerified(userId: string): Promise<boolean>;
	/** Works in the admin panel (`isSuperAdmin`, or a SuperAdmin / Admin / Platform Developer role): the operations alerts are theirs. */
	usesAdminPanel(userId: string): Promise<boolean>;

	listDevices(userId: string, currentSessionId: string | null): Promise<readonly PushDeviceResponse[]>;
	activeDevices(userId: string): Promise<readonly (ActivePushDevice & { readonly lastSeenAt: number })[]>;
	/** The same token from the same person refreshes its row instead of adding one. */
	findDeviceByTokenHash(tokenHash: string): Promise<{ readonly id: string; readonly userId: string } | null>;
	insertDevice(device: NewPushDevice, now: number): Promise<void>;
	touchDevice(
		deviceId: string,
		update: { readonly deviceSessionId: string; readonly surface: NotificationSurface; readonly deviceLabel: string | null; readonly appVersion: string | null },
		now: number,
	): Promise<void>;
	revokeDevice(deviceId: string, userId: string | null, reason: string, now: number): Promise<boolean>;
	device(deviceId: string): Promise<PushDeviceResponse | null>;

	listDeliveries(query: NotificationDeliveryListQuery, tenantId: string | null): Promise<PaginatedServiceResult<NotificationDeliveryEntry>>;
	/** FAILED → QUEUED; null when the delivery is not FAILED (or not push/SMS). */
	retryDelivery(deliveryId: string, now: number): Promise<NotificationDeliveryEntry | null>;
	listSuppressions(query: NotificationSuppressionListQuery): Promise<PaginatedServiceResult<NotificationSuppressionEntry>>;
	liftSuppression(suppressionId: string, reason: string, actor: string, now: number): Promise<NotificationSuppressionEntry | null>;
	suppress(channel: NotificationChannel, destinationHash: string, maskedDestination: string, cause: NotificationSuppressionCause, now: number): Promise<void>;
	/** A provider status callback: SENT → DELIVERED / FAILED by provider message id. */
	applyProviderStatus(providerMessageId: string, outcome: "DELIVERED" | "FAILED", error: string | null, now: number): Promise<void>;
	tenantName(tenantId: string): Promise<string | null>;
}
