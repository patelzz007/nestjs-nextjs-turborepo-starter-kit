import type { Prisma } from "@prisma/client";
import {
	JsonObjectSchema,
	NotificationCategorySchema,
	NotificationChannelSchema,
	NotificationDeliveryReasonSchema,
	NotificationDigestFrequencySchema,
	NotificationSurfaceSchema,
	PushPlatformSchema,
	TenantLifecycleStateSchema,
	type NotificationChannel,
	type NotificationDeliveryStatus,
	type NotificationSurface,
} from "@workspace/shared";
import { z } from "zod";

import { ADMIN_PANEL_ROLE_NAMES } from "../../../authorization/public-api";
import type { InAppRendering } from "../../domain/catalog/notification-type";
import type { StoredPreference } from "../../domain/policies/notification-rules";
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
} from "../../application/ports/notification-store.port";

/** A delivery in these states may still need the notification's payload. */
/** A QUEUED delivery untouched this long lost its job (a crash, a lost queue): the sweep queues it again. */
const STUCK_QUEUED_AFTER_MS = 600_000;
const MS_PER_DAY = 86_400_000;
/** ADR 070 retention: read inbox rows 90 days, unread 365, deliveries and notifications 180. */
const READ_INBOX_RETENTION_MS = 90 * MS_PER_DAY;
const UNREAD_INBOX_RETENTION_MS = 365 * MS_PER_DAY;
const DELIVERY_RETENTION_MS = 180 * MS_PER_DAY;
const RETENTION_ACTOR = "system:notifications.retention";
const OPEN_DELIVERY_STATES: readonly NotificationDeliveryStatus[] = ["PENDING", "HELD", "QUEUED", "SENDING"];

/** `NotificationStore` on one transaction (ADR 070); recipient data is read as a read model, never written. */
export class PrismaNotificationStore implements NotificationStore {
	public constructor(
		private readonly db: Prisma.TransactionClient,
		private readonly platformName: string,
	) {}

	public async findNotification(notificationId: string): Promise<StoredNotification | null> {
		const row = await this.db.notification.findFirst({ where: { id: notificationId, isDeleted: false } });
		if (row === null) {
			return null;
		}
		return {
			id: row.id,
			recipientUserId: row.recipientUserId,
			contactAddress: row.contactAddress,
			tenantId: row.tenantId,
			typeKey: row.typeKey,
			category: NotificationCategorySchema.parse(row.category),
			payload: JsonObjectSchema.parse(row.payload),
			locale: row.locale,
			broadcastId: row.broadcastId,
			fannedOutAt: row.fannedOutAt === null ? null : Number(row.fannedOutAt),
			notBefore: row.notBefore === null ? null : Number(row.notBefore),
			createdAt: Number(row.createdAt),
		};
	}

	public async claimForFanOut(notificationId: string, now: number): Promise<boolean> {
		// Left unclaimed (the maintenance sweep fans it out later): a notification not due yet (`notBefore`),
		// and one of a PAUSED broadcast (it continues when the broadcast resumes).
		const claimed = await this.db.$executeRaw`
			UPDATE public."Notification" n SET "fannedOutAt" = ${BigInt(now)}, "updatedAt" = ${BigInt(now)}
			WHERE n.id = ${notificationId} AND n."fannedOutAt" IS NULL AND n."isDeleted" = false
			  AND (n."notBefore" IS NULL OR n."notBefore" <= ${BigInt(now)})
			  AND (n."broadcastId" IS NULL OR NOT EXISTS (SELECT 1 FROM public."Broadcast" b WHERE b.id = n."broadcastId" AND b.status = 'PAUSED'))`;
		return claimed === 1;
	}

	public async recipientProfile(userId: string): Promise<NotificationRecipientProfile | null> {
		const user = await this.db.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				fullName: true,
				email: true,
				emailVerifiedAt: true,
				phone: true,
				phoneVerifiedAt: true,
				locale: true,
				isDeleted: true,
				isActive: true,
				isSuperAdmin: true,
			},
		});
		if (user === null) {
			return null;
		}
		const memberships = await this.db.membership.findMany({ where: { userId, isDeleted: false, status: "ACTIVE" }, select: { tenantId: true } });
		const adminRoles = await this.db.userRole.count({
			where: { userId, isDeleted: false, role: { name: { in: [...ADMIN_PANEL_ROLE_NAMES] }, tenantId: null, isDeleted: false } },
		});
		const surfaces: NotificationSurface[] = [
			"CUSTOMER",
			...(memberships.length > 0 ? (["MERCHANT"] satisfies NotificationSurface[]) : []),
			...(user.isSuperAdmin || adminRoles > 0 ? (["ADMIN"] satisfies NotificationSurface[]) : []),
		];
		return {
			userId: user.id,
			fullName: user.fullName,
			email: user.email,
			emailVerified: user.emailVerifiedAt !== null,
			phone: user.phone,
			phoneVerified: user.phoneVerifiedAt !== null,
			locale: user.locale,
			isDeleted: user.isDeleted,
			isActive: user.isActive,
			surfaces,
			memberTenantIds: memberships.map((membership): string => membership.tenantId),
		};
	}

	public async tenantStanding(tenantId: string): Promise<TenantStanding | null> {
		const tenant = await this.db.tenant.findFirst({ where: { id: tenantId }, select: { lifecycleState: true, displayName: true, broadcastsDisabledAt: true } });
		if (tenant === null) {
			return null;
		}
		return {
			lifecycleState: TenantLifecycleStateSchema.parse(tenant.lifecycleState),
			displayName: tenant.displayName,
			logoUrl: null,
			broadcastsDisabledAt: tenant.broadcastsDisabledAt === null ? null : Number(tenant.broadcastsDisabledAt),
		};
	}

	public async preferences(userId: string): Promise<readonly StoredPreference[]> {
		const rows = await this.db.notificationPreference.findMany({ where: { userId, isDeleted: false } });
		return rows.map((row): StoredPreference => ({
			tenantKey: row.tenantKey,
			category: NotificationCategorySchema.parse(row.category),
			channel: NotificationChannelSchema.parse(row.channel),
			enabled: row.enabled,
		}));
	}

	public async schedule(userId: string): Promise<StoredSchedule | null> {
		const row = await this.db.notificationSchedule.findFirst({ where: { userId, isDeleted: false } });
		if (row === null) {
			return null;
		}
		return {
			quietHoursEnabled: row.quietHoursEnabled,
			quietStartMinute: row.quietStartMinute,
			quietEndMinute: row.quietEndMinute,
			timeZone: row.timeZone,
			digestFrequency: NotificationDigestFrequencySchema.parse(row.digestFrequency),
		};
	}

	public async hasMarketingConsent(userId: string, tenantId: string | null): Promise<boolean> {
		const latest = await this.db.marketingConsent.findFirst({
			where: { userId, scope: tenantId === null ? "PLATFORM" : "TENANT", tenantId, isDeleted: false },
			orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
			select: { granted: true },
		});
		return latest?.granted ?? false;
	}

	public async hasLeftTenant(userId: string, tenantId: string): Promise<boolean> {
		const link = await this.db.tenantCustomer.findFirst({ where: { userId, tenantId, isDeleted: false }, select: { leftAt: true } });
		if (link?.leftAt !== null && link?.leftAt !== undefined) {
			return true;
		}
		const ban = await this.db.tenantCustomerBan.count({ where: { tenantId, customerUserId: userId, liftedAt: null, isDeleted: false } });
		return ban > 0;
	}

	public async isSuppressed(channel: NotificationChannel, destinationHash: string): Promise<boolean> {
		return (await this.db.notificationSuppression.count({ where: { channel, destinationHash, liftedAt: null, isDeleted: false } })) > 0;
	}

	public async activePushDevices(userId: string): Promise<readonly ActivePushDevice[]> {
		const rows = await this.db.pushDevice.findMany({ where: { userId, revokedAt: null, isDeleted: false }, orderBy: { lastSeenAt: "desc" } });
		return rows.map((row): ActivePushDevice => ({
			id: row.id,
			platform: PushPlatformSchema.parse(row.platform),
			surface: NotificationSurfaceSchema.parse(row.surface),
			tokenCiphertext: row.tokenCiphertext,
			deviceLabel: row.deviceLabel,
		}));
	}

	public async findPushDevice(deviceId: string): Promise<(ActivePushDevice & { readonly userId: string; readonly revokedAt: number | null }) | null> {
		const row = await this.db.pushDevice.findFirst({ where: { id: deviceId, isDeleted: false } });
		if (row === null) {
			return null;
		}
		return {
			id: row.id,
			userId: row.userId,
			platform: PushPlatformSchema.parse(row.platform),
			surface: NotificationSurfaceSchema.parse(row.surface),
			tokenCiphertext: row.tokenCiphertext,
			deviceLabel: row.deviceLabel,
			revokedAt: row.revokedAt === null ? null : Number(row.revokedAt),
		};
	}

	public async revokePushDevice(deviceId: string, reason: string, now: number): Promise<void> {
		await this.db.pushDevice.updateMany({ where: { id: deviceId, revokedAt: null }, data: { revokedAt: BigInt(now), revokedReason: reason, updatedAt: BigInt(now) } });
	}

	public async findGroupedInApp(userId: string, typeKey: string, groupKey: string, since: number): Promise<readonly GroupedInApp[]> {
		const rows = await this.db.inAppNotification.findMany({
			where: { userId, typeKey, groupKey, readAt: null, archivedAt: null, isDeleted: false, createdAt: { gte: BigInt(since) } },
			select: { id: true, surface: true, groupCount: true },
		});
		return rows.map((row): GroupedInApp => ({ id: row.id, surface: NotificationSurfaceSchema.parse(row.surface), groupCount: row.groupCount }));
	}

	public async updateGroupedInApp(inAppId: string, groupCount: number, rendering: InAppRendering, now: number): Promise<void> {
		await this.db.inAppNotification.update({
			where: { id: inAppId },
			data: { groupCount, title: rendering.title, body: rendering.body, link: rendering.link, icon: rendering.icon, updatedAt: BigInt(now) },
		});
	}

	public async insertInApp(rows: readonly NewInAppNotification[]): Promise<void> {
		if (rows.length === 0) {
			return;
		}
		await this.db.inAppNotification.createMany({
			data: rows.map((row) => ({
				id: row.id,
				notificationId: row.notificationId,
				userId: row.userId,
				tenantId: row.tenantId,
				surface: row.surface,
				typeKey: row.typeKey,
				category: row.category,
				title: row.rendering.title,
				body: row.rendering.body,
				link: row.rendering.link,
				icon: row.rendering.icon,
				...(row.richBody === null ? {} : { richBody: row.richBody }),
				senderName: row.senderName,
				senderLogoUrl: row.senderLogoUrl,
				groupKey: row.groupKey,
				broadcastId: row.broadcastId,
			})),
		});
	}

	public async insertDeliveries(rows: readonly NewDelivery[]): Promise<void> {
		if (rows.length === 0) {
			return;
		}
		await this.db.notificationDelivery.createMany({
			data: rows.map((row) => ({
				id: row.id,
				notificationId: row.notificationId,
				recipientUserId: row.recipientUserId,
				tenantId: row.tenantId,
				typeKey: row.typeKey,
				channel: row.channel,
				status: row.status,
				reason: row.reason,
				heldUntil: row.heldUntil === null ? null : BigInt(row.heldUntil),
				maskedDestination: row.maskedDestination,
				pushDeviceId: row.pushDeviceId,
				providerMessageId: row.providerMessageId,
				...(row.status === "DELIVERED" || row.status === "SENT" ? { sentAt: BigInt(Date.now()) } : {}),
				...(row.status === "DELIVERED" ? { deliveredAt: BigInt(Date.now()) } : {}),
			})),
		});
	}

	public async findDelivery(deliveryId: string): Promise<StoredDelivery | null> {
		const row = await this.db.notificationDelivery.findFirst({ where: { id: deliveryId, isDeleted: false } });
		if (row === null) {
			return null;
		}
		return {
			id: row.id,
			notificationId: row.notificationId,
			channel: NotificationChannelSchema.parse(row.channel),
			status: row.status,
			reason: row.reason === null ? null : NotificationDeliveryReasonSchema.parse(row.reason),
			attempts: row.attempts,
			pushDeviceId: row.pushDeviceId,
			recipientUserId: row.recipientUserId,
			tenantId: row.tenantId,
			typeKey: row.typeKey,
		};
	}

	public async transitionDelivery(deliveryId: string, from: NotificationDeliveryStatus, to: NotificationDeliveryStatus, now: number): Promise<boolean> {
		const moved = await this.db.notificationDelivery.updateMany({
			where: { id: deliveryId, status: from },
			data: { status: to, updatedAt: BigInt(now), ...(to === "SENDING" ? { attempts: { increment: 1 } } : {}), ...(from === "HELD" ? { heldUntil: null, reason: null } : {}) },
		});
		return moved.count === 1;
	}

	public async completeDelivery(
		deliveryId: string,
		outcome: { readonly status: NotificationDeliveryStatus; readonly reason: string | null; readonly providerMessageId: string | null; readonly error: string | null },
		now: number,
	): Promise<void> {
		await this.db.notificationDelivery.update({
			where: { id: deliveryId },
			data: {
				status: outcome.status,
				reason: outcome.reason,
				providerMessageId: outcome.providerMessageId,
				lastError: outcome.error,
				updatedAt: BigInt(now),
				...(outcome.status === "SENT" || outcome.status === "DELIVERED" ? { sentAt: BigInt(now) } : {}),
			},
		});
	}

	public async scrubPayloadWhenDone(notificationId: string, now: number): Promise<void> {
		const open = await this.db.notificationDelivery.count({ where: { notificationId, status: { in: [...OPEN_DELIVERY_STATES] } } });
		if (open === 0) {
			await this.db.notification.update({ where: { id: notificationId }, data: { payload: {}, updatedAt: BigInt(now) } });
		}
	}

	public async unreadCount(userId: string, surface: NotificationSurface): Promise<number> {
		return this.db.inAppNotification.count({ where: { userId, surface, readAt: null, archivedAt: null, isDeleted: false } });
	}

	public async broadcastContent(broadcastId: string): Promise<BroadcastContent | null> {
		const broadcast = await this.db.broadcast.findFirst({ where: { id: broadcastId, isDeleted: false }, select: { body: true, tenantId: true, status: true } });
		if (broadcast === null) {
			return null;
		}
		const tenant = broadcast.tenantId === null ? null : await this.db.tenant.findFirst({ where: { id: broadcast.tenantId }, select: { displayName: true } });
		return {
			richBody: JsonObjectSchema.parse(broadcast.body),
			senderName: tenant?.displayName ?? this.platformName,
			senderLogoUrl: null,
			stopped: broadcast.status === "CANCELLED" || broadcast.status === "FAILED",
		};
	}

	public async dueDeliveries(
		now: number,
		limit: number,
	): Promise<readonly { readonly id: string; readonly channel: NotificationChannel; readonly status: NotificationDeliveryStatus }[]> {
		const rows = await this.db.notificationDelivery.findMany({
			where: {
				channel: { in: ["PUSH", "SMS"] },
				isDeleted: false,
				OR: [
					{ status: "HELD", reason: "quiet-hours", heldUntil: { lte: BigInt(now) } },
					{ status: "QUEUED", updatedAt: { lte: BigInt(now - STUCK_QUEUED_AFTER_MS) } },
				],
			},
			orderBy: { createdAt: "asc" },
			take: limit,
			select: { id: true, channel: true, status: true },
		});
		return rows.map((row) => ({ id: row.id, channel: NotificationChannelSchema.parse(row.channel), status: row.status }));
	}

	public async dueDigestDeliveries(now: number, limit: number): Promise<readonly DueDigestDelivery[]> {
		const rows = await this.db.notificationDelivery.findMany({
			where: { channel: "EMAIL", status: "HELD", reason: "digest", heldUntil: { lte: BigInt(now) }, isDeleted: false, recipientUserId: { not: null } },
			orderBy: { createdAt: "asc" },
			take: limit,
			select: { id: true, notificationId: true, recipientUserId: true },
		});
		const due: DueDigestDelivery[] = [];
		for (const row of rows) {
			const notification = await this.findNotification(row.notificationId);
			const userId = row.recipientUserId;
			if (notification === null || userId === null) {
				continue;
			}
			const user = await this.db.user.findUnique({ where: { id: userId }, select: { email: true, isDeleted: true } });
			const schedule = await this.schedule(userId);
			if (user === null || user.isDeleted) {
				continue;
			}
			due.push({ deliveryId: row.id, userId, email: user.email, notification, digestFrequency: schedule?.digestFrequency ?? "DAILY" });
		}
		return due;
	}

	public async completeDigest(
		deliveryIds: readonly string[],
		outcome: { readonly status: NotificationDeliveryStatus; readonly providerMessageId: string | null },
		now: number,
	): Promise<void> {
		await this.db.notificationDelivery.updateMany({
			where: { id: { in: [...deliveryIds] }, status: "HELD" },
			data: { status: outcome.status, reason: null, heldUntil: null, providerMessageId: outcome.providerMessageId, updatedAt: BigInt(now), sentAt: BigInt(now) },
		});
	}

	public async applyRetention(now: number): Promise<{ readonly inApp: number; readonly deliveries: number; readonly notifications: number }> {
		const soft = { isDeleted: true, deletedAt: BigInt(now), deletedBy: RETENTION_ACTOR, updatedAt: BigInt(now) };
		const readInbox = await this.db.inAppNotification.updateMany({ where: { isDeleted: false, readAt: { lte: BigInt(now - READ_INBOX_RETENTION_MS) } }, data: soft });
		const unreadInbox = await this.db.inAppNotification.updateMany({
			where: { isDeleted: false, readAt: null, createdAt: { lte: BigInt(now - UNREAD_INBOX_RETENTION_MS) } },
			data: soft,
		});
		const deliveries = await this.db.notificationDelivery.updateMany({ where: { isDeleted: false, createdAt: { lte: BigInt(now - DELIVERY_RETENTION_MS) } }, data: soft });
		const notifications = await this.db.notification.updateMany({
			where: { isDeleted: false, createdAt: { lte: BigInt(now - DELIVERY_RETENTION_MS) } },
			data: { ...soft, payload: {} },
		});
		return { inApp: readInbox.count + unreadInbox.count, deliveries: deliveries.count, notifications: notifications.count };
	}

	public async revokeDevicesOfEndedSessions(now: number): Promise<number> {
		const devices = await this.db.pushDevice.findMany({ where: { revokedAt: null, isDeleted: false }, select: { id: true, deviceSessionId: true } });
		if (devices.length === 0) {
			return 0;
		}
		const live = await this.db.refreshToken.findMany({
			where: { id: { in: devices.map((device): string => device.deviceSessionId) }, isDeleted: false, expiresAt: { gt: BigInt(now) } },
			select: { id: true },
		});
		const liveIds = new Set<string>(live.map((session): string => session.id));
		const ended = devices.filter((device): boolean => !liveIds.has(device.deviceSessionId)).map((device): string => device.id);
		if (ended.length === 0) {
			return 0;
		}
		const revoked = await this.db.pushDevice.updateMany({
			where: { id: { in: ended }, revokedAt: null },
			data: { revokedAt: BigInt(now), revokedReason: "session-ended", updatedAt: BigInt(now) },
		});
		return revoked.count;
	}

	public async unfannedNotifications(olderThan: number, now: number, limit: number): Promise<readonly string[]> {
		const rows = z.array(z.object({ id: z.string() })).parse(
			await this.db.$queryRaw`
				SELECT n.id FROM public."Notification" n
				WHERE n."fannedOutAt" IS NULL AND n."isDeleted" = false AND n."createdAt" <= ${BigInt(olderThan)}
				  AND (n."notBefore" IS NULL OR n."notBefore" <= ${BigInt(now)})
				  AND (n."broadcastId" IS NULL OR NOT EXISTS (SELECT 1 FROM public."Broadcast" b WHERE b.id = n."broadcastId" AND b.status = 'PAUSED'))
				ORDER BY n."createdAt" ASC
				LIMIT ${limit}`,
		);
		return rows.map((row): string => row.id);
	}
}
