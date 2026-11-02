// TEST-ONLY real in-memory implementation of `NotificationStore` (the Prisma store's semantics:
// conditional claims and transitions, the latest consent decides, revoked devices are gone).
import type { NotificationChannel, NotificationDeliveryStatus, NotificationSurface } from "@workspace/shared";

import type { InAppRendering } from "../../../domain/catalog/notification-type";
import type { StoredPreference } from "../../../domain/policies/notification-rules";
import type {
	ActivePushDevice,
	BroadcastContent,
	DueDigestDelivery,
	GroupedInApp,
	NewDelivery,
	NewInAppNotification,
	NotificationRecipientProfile,
	NotificationStore,
	StoredDelivery,
	StoredNotification,
	StoredSchedule,
	TenantStanding,
} from "../../ports/notification-store.port";

export interface StoredInApp extends NewInAppNotification {
	groupCount: number;
	readAt: number | null;
	createdAt: number;
	title: string;
	body: string;
}

export interface StoredTestDelivery extends NewDelivery {
	status: NotificationDeliveryStatus;
	attempts: number;
	lastError: string | null;
	reasonNow: string | null;
}

export interface StoredDevice extends ActivePushDevice {
	readonly userId: string;
	revokedAt: number | null;
	revokedReason: string | null;
}

export class InMemoryNotificationStore implements NotificationStore {
	public readonly notifications = new Map<string, StoredNotification>();
	public readonly profiles = new Map<string, NotificationRecipientProfile>();
	public readonly tenants = new Map<string, TenantStanding>();
	public readonly storedPreferences = new Map<string, StoredPreference[]>();
	public readonly schedules = new Map<string, StoredSchedule>();
	/** `${userId}|${tenantId ?? "platform"}` → the latest consent decision. */
	public readonly consents = new Map<string, boolean>();
	public readonly leftTenants = new Set<string>();
	public readonly suppressions = new Set<string>();
	public readonly devices = new Map<string, StoredDevice>();
	public readonly inApps: StoredInApp[] = [];
	public readonly deliveries: StoredTestDelivery[] = [];
	public readonly scrubbed: string[] = [];

	public constructor(private readonly now: () => number) {}

	public findNotification(notificationId: string): Promise<StoredNotification | null> {
		return Promise.resolve(this.notifications.get(notificationId) ?? null);
	}

	public claimForFanOut(notificationId: string, now: number): Promise<boolean> {
		const row = this.notifications.get(notificationId);
		if (row === undefined || row.fannedOutAt !== null || (row.notBefore !== null && row.notBefore > now)) {
			return Promise.resolve(false);
		}
		this.notifications.set(notificationId, { ...row, fannedOutAt: now });
		return Promise.resolve(true);
	}

	public recipientProfile(userId: string): Promise<NotificationRecipientProfile | null> {
		return Promise.resolve(this.profiles.get(userId) ?? null);
	}

	public tenantStanding(tenantId: string): Promise<TenantStanding | null> {
		return Promise.resolve(this.tenants.get(tenantId) ?? null);
	}

	public preferences(userId: string): Promise<readonly StoredPreference[]> {
		return Promise.resolve(this.storedPreferences.get(userId) ?? []);
	}

	public schedule(userId: string): Promise<StoredSchedule | null> {
		return Promise.resolve(this.schedules.get(userId) ?? null);
	}

	public hasMarketingConsent(userId: string, tenantId: string | null): Promise<boolean> {
		return Promise.resolve(this.consents.get(`${userId}|${tenantId ?? "platform"}`) ?? false);
	}

	public hasLeftTenant(userId: string, tenantId: string): Promise<boolean> {
		return Promise.resolve(this.leftTenants.has(`${userId}|${tenantId}`));
	}

	public isSuppressed(channel: NotificationChannel, destinationHash: string): Promise<boolean> {
		return Promise.resolve(this.suppressions.has(`${channel}|${destinationHash}`));
	}

	public activePushDevices(userId: string): Promise<readonly ActivePushDevice[]> {
		return Promise.resolve([...this.devices.values()].filter((device): boolean => device.userId === userId && device.revokedAt === null));
	}

	public findPushDevice(deviceId: string): Promise<(ActivePushDevice & { readonly userId: string; readonly revokedAt: number | null }) | null> {
		return Promise.resolve(this.devices.get(deviceId) ?? null);
	}

	public revokePushDevice(deviceId: string, reason: string, now: number): Promise<void> {
		const device = this.devices.get(deviceId);
		if (device?.revokedAt === null) {
			device.revokedAt = now;
			device.revokedReason = reason;
		}
		return Promise.resolve();
	}

	public findGroupedInApp(userId: string, typeKey: string, groupKey: string, since: number): Promise<readonly GroupedInApp[]> {
		return Promise.resolve(
			this.inApps
				.filter((row): boolean => row.userId === userId && row.typeKey === typeKey && row.groupKey === groupKey && row.readAt === null && row.createdAt >= since)
				.map((row): GroupedInApp => ({ id: row.id, surface: row.surface, groupCount: row.groupCount })),
		);
	}

	public updateGroupedInApp(inAppId: string, groupCount: number, rendering: InAppRendering): Promise<void> {
		const row = this.inApps.find((candidate): boolean => candidate.id === inAppId);
		if (row !== undefined) {
			row.groupCount = groupCount;
			row.title = rendering.title;
			row.body = rendering.body;
		}
		return Promise.resolve();
	}

	public insertInApp(rows: readonly NewInAppNotification[]): Promise<void> {
		for (const row of rows) {
			this.inApps.push({ ...row, groupCount: 1, readAt: null, createdAt: this.now(), title: row.rendering.title, body: row.rendering.body });
		}
		return Promise.resolve();
	}

	public insertDeliveries(rows: readonly NewDelivery[]): Promise<void> {
		for (const row of rows) {
			this.deliveries.push({ ...row, attempts: 0, lastError: null, reasonNow: row.reason });
		}
		return Promise.resolve();
	}

	public findDelivery(deliveryId: string): Promise<StoredDelivery | null> {
		const row = this.deliveries.find((candidate): boolean => candidate.id === deliveryId);
		return Promise.resolve(
			row === undefined
				? null
				: {
						id: row.id,
						notificationId: row.notificationId,
						channel: row.channel,
						status: row.status,
						reason: row.reason,
						attempts: row.attempts,
						pushDeviceId: row.pushDeviceId,
						recipientUserId: row.recipientUserId,
						tenantId: row.tenantId,
						typeKey: row.typeKey,
					},
		);
	}

	public transitionDelivery(deliveryId: string, from: NotificationDeliveryStatus, to: NotificationDeliveryStatus): Promise<boolean> {
		const row = this.deliveries.find((candidate): boolean => candidate.id === deliveryId);
		if (row?.status !== from) {
			return Promise.resolve(false);
		}
		row.status = to;
		if (to === "SENDING") {
			row.attempts += 1;
		}
		return Promise.resolve(true);
	}

	public completeDelivery(
		deliveryId: string,
		outcome: { readonly status: NotificationDeliveryStatus; readonly reason: string | null; readonly providerMessageId: string | null; readonly error: string | null },
	): Promise<void> {
		const row = this.deliveries.find((candidate): boolean => candidate.id === deliveryId);
		if (row !== undefined) {
			row.status = outcome.status;
			row.reasonNow = outcome.reason;
			row.lastError = outcome.error;
		}
		return Promise.resolve();
	}

	public scrubPayloadWhenDone(notificationId: string): Promise<void> {
		const open = this.deliveries.some(
			(row): boolean => row.notificationId === notificationId && (row.status === "PENDING" || row.status === "HELD" || row.status === "QUEUED" || row.status === "SENDING"),
		);
		if (!open) {
			this.scrubbed.push(notificationId);
		}
		return Promise.resolve();
	}

	public readonly broadcasts = new Map<string, BroadcastContent>();

	public broadcastContent(broadcastId: string): Promise<BroadcastContent | null> {
		return Promise.resolve(this.broadcasts.get(broadcastId) ?? null);
	}

	public dueDeliveries(
		now: number,
		limit: number,
	): Promise<readonly { readonly id: string; readonly channel: NotificationChannel; readonly status: NotificationDeliveryStatus }[]> {
		return Promise.resolve(
			this.deliveries
				.filter((row): boolean => (row.channel === "PUSH" || row.channel === "SMS") && row.status === "HELD" && (row.heldUntil ?? Number.MAX_SAFE_INTEGER) <= now)
				.slice(0, limit)
				.map((row) => ({ id: row.id, channel: row.channel, status: row.status })),
		);
	}

	public readonly retentionRuns: number[] = [];
	public endedSessionRevocations = 0;

	public dueDigestDeliveries(now: number, limit: number): Promise<readonly DueDigestDelivery[]> {
		const due: DueDigestDelivery[] = [];
		for (const row of this.deliveries) {
			const notification = this.notifications.get(row.notificationId);
			const profile = row.recipientUserId === null ? undefined : this.profiles.get(row.recipientUserId);
			if (row.channel === "EMAIL" && row.status === "HELD" && (row.heldUntil ?? Number.MAX_SAFE_INTEGER) <= now && notification !== undefined && profile !== undefined) {
				due.push({
					deliveryId: row.id,
					userId: profile.userId,
					email: profile.email,
					notification,
					digestFrequency: this.schedules.get(profile.userId)?.digestFrequency ?? "DAILY",
				});
			}
		}
		return Promise.resolve(due.slice(0, limit));
	}

	public completeDigest(deliveryIds: readonly string[], outcome: { readonly status: NotificationDeliveryStatus }): Promise<void> {
		for (const row of this.deliveries) {
			if (deliveryIds.includes(row.id)) {
				row.status = outcome.status;
			}
		}
		return Promise.resolve();
	}

	public applyRetention(now: number): Promise<{ readonly inApp: number; readonly deliveries: number; readonly notifications: number }> {
		this.retentionRuns.push(now);
		return Promise.resolve({ inApp: 0, deliveries: 0, notifications: 0 });
	}

	public revokeDevicesOfEndedSessions(): Promise<number> {
		return Promise.resolve(this.endedSessionRevocations);
	}

	public unfannedNotifications(olderThan: number, now: number, limit: number): Promise<readonly string[]> {
		return Promise.resolve(
			[...this.notifications.values()]
				.filter((row): boolean => row.fannedOutAt === null && row.createdAt <= olderThan && (row.notBefore === null || row.notBefore <= now))
				.slice(0, limit)
				.map((row): string => row.id),
		);
	}

	public unreadCount(userId: string, surface: NotificationSurface): Promise<number> {
		return Promise.resolve(this.inApps.filter((row): boolean => row.userId === userId && row.surface === surface && row.readAt === null).length);
	}
}
