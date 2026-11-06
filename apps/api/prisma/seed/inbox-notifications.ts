// ============================================
// prisma/seed/inbox-notifications.ts — notifications already in someone's inbox (ADR 070)
// ============================================
// A seeded notice looks exactly like one the fan-out delivered: the `Notification` row (already fanned
// out, so the running API never delivers it again) and its `InAppNotification`, with the words the
// catalog type renders — never copy typed here.

import type { NotificationSurface } from "@prisma/client";
import type { NotificationAttachment } from "@workspace/shared";

import { DEFAULT_NOTIFICATION_LOCALE, type NotificationRenderContext, type TypedNotificationType } from "../../src/contexts/notifications/domain/catalog/notification-type";
import { prisma } from "./client";

/** The render context of seeded notices: their in-app copy and links name no origin. */
const SEED_RENDER_CONTEXT: NotificationRenderContext = {
	appName: "Rewards",
	webUrl: "http://localhost:3000",
	merchantUrl: "http://localhost:3002",
	adminUrl: "http://localhost:3001",
	groupCount: 1,
};

export interface SeedInboxNotification<TPayload> {
	readonly type: TypedNotificationType<TPayload>;
	readonly userId: string;
	readonly surface: NotificationSurface;
	readonly payload: TPayload;
	/** Deterministic, so a re-run converges instead of duplicating. */
	readonly dedupeKey: string;
	readonly tenantId: string | null;
	readonly createdAt: bigint;
	readonly readAt: bigint | null;
	/** A public file sent with it. */
	readonly attachment?: NotificationAttachment;
}

/** Writes one delivered in-app notice; a repeat of the same dedupe key writes nothing. */
export async function seedInboxNotification<TPayload>(notice: SeedInboxNotification<TPayload>): Promise<void> {
	const payload = notice.type.declaration.toJson(notice.payload);
	const rendering = notice.type.renderInApp(payload, DEFAULT_NOTIFICATION_LOCALE, SEED_RENDER_CONTEXT);
	if (rendering === null) {
		throw new Error(`Seed: "${notice.type.key}" has no in-app rendering`);
	}
	const existing = await prisma.notification.findUnique({
		where: { recipientKey_typeKey_dedupeKey: { recipientKey: notice.userId, typeKey: notice.type.key, dedupeKey: notice.dedupeKey } },
		select: { id: true },
	});
	if (existing !== null) {
		return;
	}
	const notification = await prisma.notification.create({
		data: {
			createdAt: notice.createdAt,
			updatedAt: notice.createdAt,
			recipientUserId: notice.userId,
			recipientKey: notice.userId,
			contactAddress: null,
			tenantId: notice.tenantId,
			typeKey: notice.type.key,
			category: notice.type.category,
			dedupeKey: notice.dedupeKey,
			payload,
			locale: DEFAULT_NOTIFICATION_LOCALE,
			fannedOutAt: notice.createdAt,
			...(notice.attachment === undefined ? {} : { attachment: notice.attachment }),
		},
	});
	await prisma.inAppNotification.create({
		data: {
			createdAt: notice.createdAt,
			updatedAt: notice.readAt ?? notice.createdAt,
			notificationId: notification.id,
			userId: notice.userId,
			tenantId: notice.tenantId,
			surface: notice.surface,
			typeKey: notice.type.key,
			category: notice.type.category,
			title: rendering.title,
			body: rendering.body,
			link: rendering.link,
			icon: rendering.icon,
			readAt: notice.readAt,
			...(notice.attachment === undefined ? {} : { attachment: notice.attachment }),
		},
	});
}

/** Removes the seed users' notifications (inbox rows, deliveries, the notifications) so a re-run converges. */
export async function cleanupSeedInboxNotifications(userIds: readonly string[]): Promise<void> {
	const userId = { in: [...userIds] };
	await prisma.inAppNotification.deleteMany({ where: { userId } });
	await prisma.notificationDelivery.deleteMany({ where: { notification: { recipientUserId: userId } } });
	await prisma.notification.deleteMany({ where: { recipientUserId: userId } });
}
