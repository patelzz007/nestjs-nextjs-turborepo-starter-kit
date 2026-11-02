import type { InAppNotification, NotificationDelivery, NotificationSuppression, PushDevice } from "@prisma/client";
import {
	EpochMsSchema,
	NotificationCategorySchema,
	NotificationChannelSchema,
	NotificationDeliveryReasonSchema,
	NotificationSuppressionCauseSchema,
	NotificationSurfaceSchema,
	PushPlatformSchema,
	RichTextDocumentSchema,
	type EpochMs,
	type InAppNotificationResponse,
	type NotificationDeliveryEntry,
	type NotificationSuppressionEntry,
	type PushDeviceResponse,
} from "@workspace/shared";

export function epochOf(value: bigint): EpochMs {
	return EpochMsSchema.parse(Number(value));
}

export function epochOrNull(value: bigint | null): EpochMs | null {
	return value === null ? null : epochOf(value);
}

function base(row: { readonly createdAt: bigint; readonly updatedAt: bigint; readonly isDeleted: boolean; readonly deletedAt: bigint | null }): {
	readonly createdAt: EpochMs;
	readonly updatedAt: EpochMs;
	readonly isDeleted: boolean;
	readonly deletedAt: EpochMs | null;
} {
	return { createdAt: epochOf(row.createdAt), updatedAt: epochOf(row.updatedAt), isDeleted: row.isDeleted, deletedAt: epochOrNull(row.deletedAt) };
}

export function toInAppNotificationResponse(row: InAppNotification): InAppNotificationResponse {
	const rich = row.richBody === null ? null : RichTextDocumentSchema.safeParse(row.richBody);
	return {
		...base(row),
		id: row.id,
		typeKey: row.typeKey,
		category: NotificationCategorySchema.parse(row.category),
		surface: NotificationSurfaceSchema.parse(row.surface),
		title: row.title,
		body: row.body,
		richBody: rich?.success === true ? rich.data : null,
		link: row.link,
		icon: row.icon,
		senderName: row.senderName,
		senderLogoUrl: row.senderLogoUrl,
		groupCount: row.groupCount,
		broadcastId: row.broadcastId,
		readAt: epochOrNull(row.readAt),
		archivedAt: epochOrNull(row.archivedAt),
	};
}

export function toDeliveryEntry(row: NotificationDelivery): NotificationDeliveryEntry {
	const reason = row.reason === null ? null : NotificationDeliveryReasonSchema.safeParse(row.reason);
	return {
		...base(row),
		id: row.id,
		notificationId: row.notificationId,
		typeKey: row.typeKey,
		channel: NotificationChannelSchema.parse(row.channel),
		status: row.status,
		reason: reason?.success === true ? reason.data : null,
		tenantId: row.tenantId,
		recipientUserId: row.recipientUserId,
		maskedDestination: row.maskedDestination,
		attempts: row.attempts,
		providerMessageId: row.providerMessageId,
		lastError: row.lastError,
		heldUntil: epochOrNull(row.heldUntil),
		sentAt: epochOrNull(row.sentAt),
		deliveredAt: epochOrNull(row.deliveredAt),
		openedAt: epochOrNull(row.openedAt),
	};
}

export function toSuppressionEntry(row: NotificationSuppression): NotificationSuppressionEntry {
	return {
		...base(row),
		id: row.id,
		channel: NotificationChannelSchema.parse(row.channel),
		maskedDestination: row.maskedDestination,
		cause: NotificationSuppressionCauseSchema.parse(row.cause),
		liftedAt: epochOrNull(row.liftedAt),
		liftReason: row.liftReason,
	};
}

export function toPushDeviceResponse(row: PushDevice, currentSessionId: string | null): PushDeviceResponse {
	return {
		...base(row),
		id: row.id,
		platform: PushPlatformSchema.parse(row.platform),
		surface: NotificationSurfaceSchema.parse(row.surface),
		deviceLabel: row.deviceLabel,
		appVersion: row.appVersion,
		lastSeenAt: epochOf(row.lastSeenAt),
		isCurrentSession: currentSessionId !== null && row.deviceSessionId === currentSessionId,
	};
}
