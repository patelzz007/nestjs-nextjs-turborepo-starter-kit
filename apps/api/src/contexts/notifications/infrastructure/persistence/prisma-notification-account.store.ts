import type { InAppNotification, NotificationDelivery, NotificationSuppression, Prisma } from "@prisma/client";
import {
	inAppNotificationListQuery,
	NotificationCategorySchema,
	NotificationChannelSchema,
	NotificationDigestFrequencySchema,
	notificationDeliveryListQuery,
	notificationSuppressionListQuery,
	NotificationSurfaceSchema,
	PushPlatformSchema,
	type InAppNotificationListQuery,
	type InAppNotificationResponse,
	type NotificationCategory,
	type NotificationChannel,
	type NotificationDeliveryEntry,
	type NotificationDeliveryListQuery,
	type NotificationSuppressionCause,
	type NotificationSuppressionEntry,
	type NotificationSuppressionListQuery,
	type NotificationSurface,
	type PaginatedServiceResult,
	type PushDeviceResponse,
} from "@workspace/shared";

import { ADMIN_PANEL_ROLE_NAMES } from "../../../authorization/public-api";
import { timestampIdKeyset, type ListKeyset } from "../../../../platform/infrastructure/persistence/list-query/keyset-cursor";
import { buildListOrder, type SortColumns } from "../../../../platform/infrastructure/persistence/list-query/list-order";
import {
	fieldWhere,
	toPrismaComparableFilter,
	toPrismaEqualityFilter,
	toPrismaNullableComparableFilter,
} from "../../../../platform/infrastructure/persistence/list-query/prisma-filter";
import { fetchListPage, mapListResult, toPaginatedServiceResult } from "../../../../platform/infrastructure/persistence/list-page";
import type { ConsentRecord, NewPushDevice, NotificationAccountStore, PushDeviceTouch, TenantLink } from "../../application/ports/notification-account-store.port";
import type { ActivePushDevice, StoredSchedule } from "../../application/ports/notification-store.port";
import { PLATFORM_PREFERENCE_KEY, type StoredPreference } from "../../domain/policies/notification-rules";
import type { PublicUrlResolve } from "../../../../config/public-url.resolver";
import { toDeliveryEntry, toInAppNotificationResponse, toPushDeviceResponse, toSuppressionEntry } from "./notification-row.mappers";

const IN_APP_KEYSET: ListKeyset<InAppNotification, Prisma.InAppNotificationWhereInput> = timestampIdKeyset(
	(row: InAppNotification) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.InAppNotificationWhereInput => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
);
const DELIVERY_KEYSET: ListKeyset<NotificationDelivery, Prisma.NotificationDeliveryWhereInput> = timestampIdKeyset(
	(row: NotificationDelivery) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.NotificationDeliveryWhereInput => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
);
const SUPPRESSION_KEYSET: ListKeyset<NotificationSuppression, Prisma.NotificationSuppressionWhereInput> = timestampIdKeyset(
	(row: NotificationSuppression) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.NotificationSuppressionWhereInput => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
);

const CREATED_AT_COLUMNS_INAPPNOTIFICATION: SortColumns<"createdAt", Prisma.InAppNotificationOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
};
const CREATED_AT_COLUMNS_NOTIFICATIONDELIVERY: SortColumns<"createdAt", Prisma.NotificationDeliveryOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
};
const CREATED_AT_COLUMNS_NOTIFICATIONSUPPRESSION: SortColumns<"createdAt", Prisma.NotificationSuppressionOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
};

/** One person's live notifications on ONE surface + the filter AST (`filter[readAt][isNull]=true` = unread). */
export function buildInAppNotificationListWhere(userId: string, query: InAppNotificationListQuery): Prisma.InAppNotificationWhereInput {
	return {
		AND: [
			{ userId, surface: query.surface, isDeleted: false },
			...fieldWhere(toPrismaNullableComparableFilter(query.filter?.readAt), (readAt): Prisma.InAppNotificationWhereInput => ({ readAt })),
			...fieldWhere(toPrismaNullableComparableFilter(query.filter?.archivedAt), (archivedAt): Prisma.InAppNotificationWhereInput => ({ archivedAt })),
			...fieldWhere(toPrismaEqualityFilter(query.filter?.category), (category): Prisma.InAppNotificationWhereInput => ({ category })),
		],
	};
}

/** The person's own notification data and the admin readers (ADR 070), on one transaction. */
export class PrismaNotificationAccountStore implements NotificationAccountStore {
	public constructor(
		private readonly db: Prisma.TransactionClient,
		/** Gives an inbox row's attachment its public address. */
		private readonly resolve: PublicUrlResolve,
	) {}

	public async listInbox(userId: string, query: InAppNotificationListQuery): Promise<PaginatedServiceResult<InAppNotificationResponse>> {
		const where = buildInAppNotificationListWhere(userId, query);
		const page = await fetchListPage(query, {
			where,
			order: buildListOrder(inAppNotificationListQuery.resolveSort(query.sort), {
				columns: CREATED_AT_COLUMNS_INAPPNOTIFICATION,
				tieBreaker: (direction): Prisma.InAppNotificationOrderByWithRelationInput => ({ id: direction }),
			}),
			keyset: IN_APP_KEYSET,
			and: (left, right): Prisma.InAppNotificationWhereInput => ({ AND: [left, right] }),
			count: (filter): Promise<number> => this.db.inAppNotification.count({ where: filter }),
			findMany: (args): Promise<InAppNotification[]> => this.db.inAppNotification.findMany(args),
		});
		return toPaginatedServiceResult(
			mapListResult(page, (row): InAppNotificationResponse => toInAppNotificationResponse(row, this.resolve)),
			query,
		);
	}

	public async markRead(userId: string, surface: NotificationSurface, selection: readonly string[] | "all", now: number): Promise<readonly string[]> {
		const where: Prisma.InAppNotificationWhereInput = { userId, surface, readAt: null, isDeleted: false, ...(selection === "all" ? {} : { id: { in: [...selection] } }) };
		const rows = await this.db.inAppNotification.findMany({ where, select: { notificationId: true } });
		await this.db.inAppNotification.updateMany({ where, data: { readAt: BigInt(now), updatedAt: BigInt(now) } });
		return [...new Set(rows.flatMap((row): string[] => (row.notificationId === null ? [] : [row.notificationId])))];
	}

	public async markNotificationsRead(userId: string, notificationIds: readonly string[], now: number): Promise<void> {
		if (notificationIds.length === 0) {
			return;
		}
		await this.db.inAppNotification.updateMany({
			where: { userId, notificationId: { in: [...notificationIds] }, readAt: null },
			data: { readAt: BigInt(now), updatedAt: BigInt(now) },
		});
	}

	public async archive(userId: string, inAppIds: readonly string[], now: number): Promise<void> {
		await this.db.inAppNotification.updateMany({
			where: { userId, id: { in: [...inAppIds] }, archivedAt: null },
			data: { archivedAt: BigInt(now), readAt: BigInt(now), updatedAt: BigInt(now) },
		});
	}

	public async markPushOpened(userId: string, deliveryId: string, now: number): Promise<string | null> {
		const delivery = await this.db.notificationDelivery.findFirst({ where: { id: deliveryId, recipientUserId: userId, channel: "PUSH" }, select: { notificationId: true } });
		if (delivery === null) {
			return null;
		}
		await this.db.notificationDelivery.updateMany({ where: { id: deliveryId, openedAt: null }, data: { openedAt: BigInt(now), updatedAt: BigInt(now) } });
		await this.markNotificationsRead(userId, [delivery.notificationId], now);
		return delivery.notificationId;
	}

	public unreadCount(userId: string, surface: NotificationSurface): Promise<number> {
		return this.db.inAppNotification.count({ where: { userId, surface, readAt: null, archivedAt: null, isDeleted: false } });
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

	public async savePreferences(
		userId: string,
		tenantKey: string,
		changes: readonly { readonly category: NotificationCategory; readonly channel: NotificationChannel; readonly enabled: boolean }[],
		now: number,
	): Promise<void> {
		for (const change of changes) {
			await this.db.notificationPreference.upsert({
				where: { userId_tenantKey_category_channel: { userId, tenantKey, category: change.category, channel: change.channel } },
				create: { userId, tenantKey, category: change.category, channel: change.channel, enabled: change.enabled, createdBy: userId, updatedBy: userId },
				update: { enabled: change.enabled, updatedAt: BigInt(now), updatedBy: userId, isDeleted: false, deletedAt: null, deletedBy: null },
			});
		}
	}

	public async schedule(userId: string): Promise<StoredSchedule | null> {
		const row = await this.db.notificationSchedule.findFirst({ where: { userId, isDeleted: false } });
		return row === null
			? null
			: {
					quietHoursEnabled: row.quietHoursEnabled,
					quietStartMinute: row.quietStartMinute,
					quietEndMinute: row.quietEndMinute,
					timeZone: row.timeZone,
					digestFrequency: NotificationDigestFrequencySchema.parse(row.digestFrequency),
				};
	}

	public async saveSchedule(userId: string, schedule: StoredSchedule, now: number): Promise<void> {
		await this.db.notificationSchedule.upsert({
			where: { userId },
			create: { userId, ...schedule, createdBy: userId, updatedBy: userId },
			update: { ...schedule, updatedAt: BigInt(now), updatedBy: userId },
		});
	}

	public async latestConsents(userId: string): Promise<ReadonlyMap<string, boolean>> {
		const rows = await this.db.marketingConsent.findMany({
			where: { userId, isDeleted: false },
			orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
			select: { tenantId: true, granted: true },
		});
		const latest = new Map<string, boolean>();
		for (const row of rows) {
			latest.set(row.tenantId ?? PLATFORM_PREFERENCE_KEY, row.granted);
		}
		return latest;
	}

	public async recordConsent(record: ConsentRecord, now: number): Promise<void> {
		await this.db.marketingConsent.create({ data: { ...record, occurredAt: BigInt(now), createdBy: record.userId, updatedBy: record.userId } });
	}

	public async tenantLinks(userId: string): Promise<readonly TenantLink[]> {
		const links = await this.db.tenantCustomer.findMany({ where: { userId, isDeleted: false }, orderBy: { lastClaimedAt: "desc" }, select: { tenantId: true, leftAt: true } });
		const tenants = await this.db.tenant.findMany({ where: { id: { in: links.map((link): string => link.tenantId) } }, select: { id: true, displayName: true } });
		const names = new Map<string, string>(tenants.map((tenant): [string, string] => [tenant.id, tenant.displayName]));
		return links.map((link): TenantLink => ({
			tenantId: link.tenantId,
			tenantName: names.get(link.tenantId) ?? "",
			leftAt: link.leftAt === null ? null : Number(link.leftAt),
		}));
	}

	public async leaveTenant(userId: string, tenantId: string, now: number): Promise<boolean> {
		const left = await this.db.tenantCustomer.updateMany({
			where: { userId, tenantId, isDeleted: false, leftAt: null },
			data: { leftAt: BigInt(now), updatedAt: BigInt(now), updatedBy: userId },
		});
		return left.count === 1;
	}

	public async phoneVerified(userId: string): Promise<boolean> {
		const user = await this.db.user.findUnique({ where: { id: userId }, select: { phoneVerifiedAt: true } });
		return user?.phoneVerifiedAt !== null && user?.phoneVerifiedAt !== undefined;
	}

	public async usesAdminPanel(userId: string): Promise<boolean> {
		const user = await this.db.user.findFirst({
			where: {
				id: userId,
				isDeleted: false,
				OR: [{ isSuperAdmin: true }, { userRoles: { some: { isDeleted: false, role: { name: { in: [...ADMIN_PANEL_ROLE_NAMES] }, tenantId: null, isDeleted: false } } } }],
			},
			select: { id: true },
		});
		return user !== null;
	}

	public async listDevices(userId: string, currentSessionId: string | null): Promise<readonly PushDeviceResponse[]> {
		const rows = await this.db.pushDevice.findMany({ where: { userId, revokedAt: null, isDeleted: false }, orderBy: { lastSeenAt: "desc" } });
		return rows.map((row): PushDeviceResponse => toPushDeviceResponse(row, currentSessionId));
	}

	public async activeDevices(userId: string): Promise<readonly (ActivePushDevice & { readonly lastSeenAt: number })[]> {
		const rows = await this.db.pushDevice.findMany({ where: { userId, revokedAt: null, isDeleted: false }, orderBy: { lastSeenAt: "asc" } });
		return rows.map((row) => ({
			id: row.id,
			platform: PushPlatformSchema.parse(row.platform),
			surface: NotificationSurfaceSchema.parse(row.surface),
			tokenCiphertext: row.tokenCiphertext,
			installationIdCiphertext: row.installationIdCiphertext,
			deviceLabel: row.deviceLabel,
			lastSeenAt: Number(row.lastSeenAt),
		}));
	}

	public findDeviceByTokenHash(tokenHash: string): Promise<{ readonly id: string; readonly userId: string } | null> {
		return this.db.pushDevice.findFirst({ where: { tokenHash, revokedAt: null, isDeleted: false }, select: { id: true, userId: true } });
	}

	public async insertDevice(device: NewPushDevice, now: number): Promise<void> {
		await this.db.pushDevice.create({ data: { ...device, lastSeenAt: BigInt(now), createdBy: device.userId, updatedBy: device.userId } });
	}

	public async touchDevice(deviceId: string, update: PushDeviceTouch, now: number): Promise<void> {
		await this.db.pushDevice.update({ where: { id: deviceId }, data: { ...update, lastSeenAt: BigInt(now), updatedAt: BigInt(now) } });
	}

	public async revokeDevice(deviceId: string, userId: string | null, reason: string, now: number): Promise<boolean> {
		const revoked = await this.db.pushDevice.updateMany({
			where: { id: deviceId, revokedAt: null, ...(userId === null ? {} : { userId }) },
			data: { revokedAt: BigInt(now), revokedReason: reason, updatedAt: BigInt(now) },
		});
		return revoked.count === 1;
	}

	public async device(deviceId: string): Promise<PushDeviceResponse | null> {
		const row = await this.db.pushDevice.findFirst({ where: { id: deviceId, isDeleted: false } });
		return row === null ? null : toPushDeviceResponse(row, null);
	}

	public async listDeliveries(query: NotificationDeliveryListQuery, tenantId: string | null): Promise<PaginatedServiceResult<NotificationDeliveryEntry>> {
		const where: Prisma.NotificationDeliveryWhereInput = {
			AND: [
				{ isDeleted: false, ...(tenantId === null ? {} : { tenantId }) },
				...fieldWhere(toPrismaEqualityFilter(query.filter?.channel), (channel): Prisma.NotificationDeliveryWhereInput => ({ channel })),
				...fieldWhere(toPrismaEqualityFilter(query.filter?.status), (status): Prisma.NotificationDeliveryWhereInput => ({ status })),
				...fieldWhere(toPrismaEqualityFilter(query.filter?.reason), (reason): Prisma.NotificationDeliveryWhereInput => ({ reason })),
				...fieldWhere(toPrismaEqualityFilter(query.filter?.typeKey), (typeKey): Prisma.NotificationDeliveryWhereInput => ({ typeKey })),
				...(tenantId === null
					? fieldWhere(toPrismaEqualityFilter(query.filter?.tenantId), (filterTenantId): Prisma.NotificationDeliveryWhereInput => ({ tenantId: filterTenantId }))
					: []),
				...fieldWhere(toPrismaComparableFilter(query.filter?.createdAt), (createdAt): Prisma.NotificationDeliveryWhereInput => ({ createdAt })),
			],
		};
		const page = await fetchListPage(query, {
			where,
			order: buildListOrder(notificationDeliveryListQuery.resolveSort(query.sort), {
				columns: CREATED_AT_COLUMNS_NOTIFICATIONDELIVERY,
				tieBreaker: (direction): Prisma.NotificationDeliveryOrderByWithRelationInput => ({ id: direction }),
			}),
			keyset: DELIVERY_KEYSET,
			and: (left, right): Prisma.NotificationDeliveryWhereInput => ({ AND: [left, right] }),
			count: (filter): Promise<number> => this.db.notificationDelivery.count({ where: filter }),
			findMany: (args): Promise<NotificationDelivery[]> => this.db.notificationDelivery.findMany(args),
		});
		return toPaginatedServiceResult(mapListResult(page, toDeliveryEntry), query);
	}

	public async retryDelivery(deliveryId: string, now: number): Promise<NotificationDeliveryEntry | null> {
		const moved = await this.db.notificationDelivery.updateMany({
			where: { id: deliveryId, status: "FAILED", channel: { in: ["PUSH", "SMS"] } },
			data: { status: "QUEUED", reason: null, lastError: null, attempts: 0, updatedAt: BigInt(now) },
		});
		if (moved.count !== 1) {
			return null;
		}
		const row = await this.db.notificationDelivery.findUnique({ where: { id: deliveryId } });
		return row === null ? null : toDeliveryEntry(row);
	}

	public async listSuppressions(query: NotificationSuppressionListQuery): Promise<PaginatedServiceResult<NotificationSuppressionEntry>> {
		const where: Prisma.NotificationSuppressionWhereInput = {
			AND: [
				{ isDeleted: false },
				...fieldWhere(toPrismaEqualityFilter(query.filter?.channel), (channel): Prisma.NotificationSuppressionWhereInput => ({ channel })),
				...fieldWhere(toPrismaEqualityFilter(query.filter?.cause), (cause): Prisma.NotificationSuppressionWhereInput => ({ cause })),
				...fieldWhere(toPrismaNullableComparableFilter(query.filter?.liftedAt), (liftedAt): Prisma.NotificationSuppressionWhereInput => ({ liftedAt })),
			],
		};
		const page = await fetchListPage(query, {
			where,
			order: buildListOrder(notificationSuppressionListQuery.resolveSort(query.sort), {
				columns: CREATED_AT_COLUMNS_NOTIFICATIONSUPPRESSION,
				tieBreaker: (direction): Prisma.NotificationSuppressionOrderByWithRelationInput => ({ id: direction }),
			}),
			keyset: SUPPRESSION_KEYSET,
			and: (left, right): Prisma.NotificationSuppressionWhereInput => ({ AND: [left, right] }),
			count: (filter): Promise<number> => this.db.notificationSuppression.count({ where: filter }),
			findMany: (args): Promise<NotificationSuppression[]> => this.db.notificationSuppression.findMany(args),
		});
		return toPaginatedServiceResult(mapListResult(page, toSuppressionEntry), query);
	}

	public async liftSuppression(suppressionId: string, reason: string, actor: string, now: number): Promise<NotificationSuppressionEntry | null> {
		const lifted = await this.db.notificationSuppression.updateMany({
			where: { id: suppressionId, liftedAt: null, isDeleted: false },
			data: { liftedAt: BigInt(now), liftedBy: actor, liftReason: reason, updatedAt: BigInt(now), updatedBy: actor },
		});
		if (lifted.count !== 1) {
			return null;
		}
		const row = await this.db.notificationSuppression.findUnique({ where: { id: suppressionId } });
		return row === null ? null : toSuppressionEntry(row);
	}

	public async suppress(channel: NotificationChannel, destinationHash: string, maskedDestination: string, cause: NotificationSuppressionCause, now: number): Promise<void> {
		const active = await this.db.notificationSuppression.count({ where: { channel, destinationHash, liftedAt: null, isDeleted: false } });
		if (active === 0) {
			await this.db.notificationSuppression.create({ data: { channel, destinationHash, maskedDestination, cause, createdAt: BigInt(now), updatedAt: BigInt(now) } });
		}
	}

	public async applyProviderStatus(providerMessageId: string, outcome: "DELIVERED" | "FAILED", error: string | null, now: number): Promise<void> {
		await this.db.notificationDelivery.updateMany({
			where: { providerMessageId, status: { in: ["SENT", "SENDING", "QUEUED"] } },
			data: { status: outcome, lastError: error, updatedAt: BigInt(now), ...(outcome === "DELIVERED" ? { deliveredAt: BigInt(now) } : {}) },
		});
	}

	public async tenantName(tenantId: string): Promise<string | null> {
		const tenant = await this.db.tenant.findFirst({ where: { id: tenantId }, select: { displayName: true } });
		return tenant?.displayName ?? null;
	}
}
