// TEST-ONLY real in-memory implementation of `NotificationAccountStore` (the Prisma store's semantics:
// the latest consent wins, a revoked device is gone, list pages are newest first).
import {
	epochMs,
	type InAppNotificationListQuery,
	type InAppNotificationResponse,
	type NotificationCategory,
	type NotificationChannel,
	type NotificationDeliveryEntry,
	type NotificationSuppressionCause,
	type NotificationSuppressionEntry,
	type NotificationSurface,
	type PaginatedServiceResult,
	type PushDeviceResponse,
} from "@workspace/shared";

import type { ConsentRecord, NewPushDevice, NotificationAccountStore, TenantLink } from "../../ports/notification-account-store.port";
import type { ActivePushDevice, StoredSchedule } from "../../ports/notification-store.port";
import { PLATFORM_PREFERENCE_KEY, type StoredPreference } from "../../../domain/policies/notification-rules";

export interface FakeInboxRow {
	readonly id: string;
	readonly notificationId: string | null;
	readonly userId: string;
	readonly surface: NotificationSurface;
	readonly createdAt: number;
	readAt: number | null;
	archivedAt: number | null;
}

interface FakeDevice extends NewPushDevice {
	lastSeenAt: number;
	revokedAt: number | null;
	revokedReason: string | null;
}

function page<T>(items: readonly T[], limit: number): PaginatedServiceResult<T> {
	return {
		items: [...items.slice(0, limit)],
		limit,
		total: items.length,
		page: 1,
		totalPages: Math.max(1, Math.ceil(items.length / limit)),
		nextCursor: null,
		hasNext: items.length > limit,
		hasPrevious: false,
	};
}

export class InMemoryNotificationAccountStore implements NotificationAccountStore {
	public readonly inbox: FakeInboxRow[] = [];
	public readonly storedPreferences: StoredPreference[] = [];
	public readonly schedules = new Map<string, StoredSchedule>();
	public readonly consents: ConsentRecord[] = [];
	public readonly links: (TenantLink & { readonly userId: string })[] = [];
	public readonly devices: FakeDevice[] = [];
	public readonly suppressions: { readonly channel: NotificationChannel; readonly destinationHash: string; readonly cause: NotificationSuppressionCause }[] = [];
	public readonly openedDeliveries = new Map<string, { readonly userId: string; readonly notificationId: string }>();
	public verifiedPhones = new Set<string>();
	/** The people who work in the admin panel (the operations alerts are theirs). */
	public adminPanelUsers = new Set<string>();

	public listInbox(userId: string, query: InAppNotificationListQuery): Promise<PaginatedServiceResult<InAppNotificationResponse>> {
		const rows = this.inbox
			.filter((row): boolean => row.userId === userId && row.surface === query.surface)
			.sort((left, right): number => right.createdAt - left.createdAt)
			.map((row): InAppNotificationResponse => ({
				id: row.id,
				typeKey: "notifications.test",
				category: "ACCOUNT",
				surface: row.surface,
				title: "Test",
				body: "Body",
				richBody: null,
				link: null,
				icon: null,
				senderName: null,
				senderLogoUrl: null,
				groupCount: 1,
				broadcastId: null,
				readAt: row.readAt === null ? null : epochMs(row.readAt),
				archivedAt: row.archivedAt === null ? null : epochMs(row.archivedAt),
				createdAt: epochMs(row.createdAt),
				updatedAt: epochMs(row.createdAt),
				isDeleted: false,
				deletedAt: null,
			}));
		return Promise.resolve(page(rows, query.limit));
	}

	public markRead(userId: string, surface: NotificationSurface, selection: readonly string[] | "all", now: number): Promise<readonly string[]> {
		const touched = this.inbox.filter(
			(row): boolean => row.userId === userId && row.surface === surface && row.readAt === null && (selection === "all" || selection.includes(row.id)),
		);
		for (const row of touched) {
			row.readAt = now;
		}
		return Promise.resolve([...new Set(touched.flatMap((row): string[] => (row.notificationId === null ? [] : [row.notificationId])))]);
	}

	public markNotificationsRead(userId: string, notificationIds: readonly string[], now: number): Promise<void> {
		for (const row of this.inbox) {
			if (row.userId === userId && row.notificationId !== null && notificationIds.includes(row.notificationId) && row.readAt === null) {
				row.readAt = now;
			}
		}
		return Promise.resolve();
	}

	public archive(userId: string, inAppIds: readonly string[], now: number): Promise<void> {
		for (const row of this.inbox) {
			if (row.userId === userId && inAppIds.includes(row.id)) {
				row.archivedAt = now;
				row.readAt ??= now;
			}
		}
		return Promise.resolve();
	}

	public async markPushOpened(userId: string, deliveryId: string, now: number): Promise<string | null> {
		const opened = this.openedDeliveries.get(deliveryId);
		if (opened?.userId !== userId) {
			return null;
		}
		await this.markNotificationsRead(userId, [opened.notificationId], now);
		return opened.notificationId;
	}

	public unreadCount(userId: string, surface: NotificationSurface): Promise<number> {
		return Promise.resolve(this.inbox.filter((row): boolean => row.userId === userId && row.surface === surface && row.readAt === null && row.archivedAt === null).length);
	}

	public preferences(userId: string): Promise<readonly StoredPreference[]> {
		void userId;
		return Promise.resolve([...this.storedPreferences]);
	}

	public savePreferences(
		_userId: string,
		tenantKey: string,
		changes: readonly { readonly category: NotificationCategory; readonly channel: NotificationChannel; readonly enabled: boolean }[],
	): Promise<void> {
		for (const change of changes) {
			const index = this.storedPreferences.findIndex((row): boolean => row.tenantKey === tenantKey && row.category === change.category && row.channel === change.channel);
			const next: StoredPreference = { tenantKey, category: change.category, channel: change.channel, enabled: change.enabled };
			if (index === -1) {
				this.storedPreferences.push(next);
			} else {
				this.storedPreferences.splice(index, 1, next);
			}
		}
		return Promise.resolve();
	}

	public schedule(userId: string): Promise<StoredSchedule | null> {
		return Promise.resolve(this.schedules.get(userId) ?? null);
	}

	public saveSchedule(userId: string, schedule: StoredSchedule): Promise<void> {
		this.schedules.set(userId, schedule);
		return Promise.resolve();
	}

	public latestConsents(userId: string): Promise<ReadonlyMap<string, boolean>> {
		const latest = new Map<string, boolean>();
		for (const consent of this.consents.filter((row): boolean => row.userId === userId)) {
			latest.set(consent.tenantId ?? PLATFORM_PREFERENCE_KEY, consent.granted);
		}
		return Promise.resolve(latest);
	}

	public recordConsent(record: ConsentRecord): Promise<void> {
		this.consents.push(record);
		return Promise.resolve();
	}

	public tenantLinks(userId: string): Promise<readonly TenantLink[]> {
		return Promise.resolve(this.links.filter((link): boolean => link.userId === userId));
	}

	public leaveTenant(userId: string, tenantId: string, now: number): Promise<boolean> {
		const index = this.links.findIndex((link): boolean => link.userId === userId && link.tenantId === tenantId && link.leftAt === null);
		const link = this.links.at(index);
		if (index === -1 || link === undefined) {
			return Promise.resolve(false);
		}
		this.links.splice(index, 1, { ...link, leftAt: now });
		return Promise.resolve(true);
	}

	public phoneVerified(userId: string): Promise<boolean> {
		return Promise.resolve(this.verifiedPhones.has(userId));
	}

	public usesAdminPanel(userId: string): Promise<boolean> {
		return Promise.resolve(this.adminPanelUsers.has(userId));
	}

	public listDevices(userId: string, currentSessionId: string | null): Promise<readonly PushDeviceResponse[]> {
		return Promise.resolve(
			this.devices
				.filter((device): boolean => device.userId === userId && device.revokedAt === null)
				.map((device): PushDeviceResponse => ({
					id: device.id,
					platform: device.platform,
					surface: device.surface,
					deviceLabel: device.deviceLabel,
					appVersion: device.appVersion,
					lastSeenAt: epochMs(device.lastSeenAt),
					isCurrentSession: device.deviceSessionId === currentSessionId,
					createdAt: epochMs(device.lastSeenAt),
					updatedAt: epochMs(device.lastSeenAt),
					isDeleted: false,
					deletedAt: null,
				})),
		);
	}

	public activeDevices(userId: string): Promise<readonly (ActivePushDevice & { readonly lastSeenAt: number })[]> {
		return Promise.resolve(
			this.devices.filter((device): boolean => device.userId === userId && device.revokedAt === null).sort((left, right): number => left.lastSeenAt - right.lastSeenAt),
		);
	}

	public findDeviceByTokenHash(tokenHash: string): Promise<{ readonly id: string; readonly userId: string } | null> {
		return Promise.resolve(this.devices.find((device): boolean => device.tokenHash === tokenHash && device.revokedAt === null) ?? null);
	}

	public insertDevice(device: NewPushDevice, now: number): Promise<void> {
		this.devices.push({ ...device, lastSeenAt: now, revokedAt: null, revokedReason: null });
		return Promise.resolve();
	}

	public touchDevice(deviceId: string, update: { readonly deviceSessionId: string }, now: number): Promise<void> {
		const index = this.devices.findIndex((device): boolean => device.id === deviceId);
		const device = this.devices.at(index);
		if (device !== undefined) {
			this.devices.splice(index, 1, { ...device, deviceSessionId: update.deviceSessionId, lastSeenAt: now });
		}
		return Promise.resolve();
	}

	public revokeDevice(deviceId: string, userId: string | null, reason: string, now: number): Promise<boolean> {
		const device = this.devices.find((candidate): boolean => candidate.id === deviceId && candidate.revokedAt === null && (userId === null || candidate.userId === userId));
		if (device === undefined) {
			return Promise.resolve(false);
		}
		device.revokedAt = now;
		device.revokedReason = reason;
		return Promise.resolve(true);
	}

	public async device(deviceId: string): Promise<PushDeviceResponse | null> {
		const device = this.devices.find((candidate): boolean => candidate.id === deviceId);
		return device === undefined ? null : ((await this.listDevices(device.userId, null)).find((candidate): boolean => candidate.id === deviceId) ?? null);
	}

	public listDeliveries(query: { readonly limit: number }): Promise<PaginatedServiceResult<NotificationDeliveryEntry>> {
		return Promise.resolve(page([], query.limit));
	}

	public retryDelivery(): Promise<NotificationDeliveryEntry | null> {
		return Promise.resolve(null);
	}

	public listSuppressions(query: { readonly limit: number }): Promise<PaginatedServiceResult<NotificationSuppressionEntry>> {
		return Promise.resolve(page([], query.limit));
	}

	public liftSuppression(): Promise<NotificationSuppressionEntry | null> {
		return Promise.resolve(null);
	}

	public suppress(channel: NotificationChannel, destinationHash: string, _maskedDestination: string, cause: NotificationSuppressionCause): Promise<void> {
		this.suppressions.push({ channel, destinationHash, cause });
		return Promise.resolve();
	}

	public applyProviderStatus(): Promise<void> {
		return Promise.resolve();
	}

	public tenantName(tenantId: string): Promise<string | null> {
		return Promise.resolve(this.links.find((link): boolean => link.tenantId === tenantId)?.tenantName ?? null);
	}
}
