import { Injectable } from "@nestjs/common";
import type { Prisma, RewardNotification } from "@prisma/client";

import { rewardNotificationListQuery, type RewardNotificationListQuery, type RewardNotificationListSortField } from "@workspace/shared";

import { fetchListPage } from "../../../platform/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../platform/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../platform/persistence/list-query/list-order";
import { fieldWhere, toPrismaNullableComparableFilter } from "../../../platform/persistence/list-query/prisma-filter";
import type { RepositoryListResult } from "../../../platform/persistence/types";
import { PrismaService } from "../../../prisma/prisma.service";

// ── List query → Prisma (explicit field → column mapping; see docs/technical/api/list-queries.md) ──

const REWARD_NOTIFICATION_SORT_COLUMNS: SortColumns<RewardNotificationListSortField, Prisma.RewardNotificationOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
};

/** Keyset for the default order (`createdAt desc, id desc`). */
const REWARD_NOTIFICATION_LIST_KEYSET: ListKeyset<RewardNotification, Prisma.RewardNotificationWhereInput> = timestampIdKeyset(
	(row: RewardNotification) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.RewardNotificationWhereInput => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
);

/** The user's live notifications + the filter AST (`filter[readAt][isNull]=true` = unread only). */
export function buildRewardNotificationListWhere(userId: string, query: RewardNotificationListQuery): Prisma.RewardNotificationWhereInput {
	return {
		AND: [{ userId, isDeleted: false }, ...fieldWhere(toPrismaNullableComparableFilter(query.filter?.readAt), (readAt) => ({ readAt }))],
	};
}

export function buildRewardNotificationListOrder(query: RewardNotificationListQuery): ListOrder<Prisma.RewardNotificationOrderByWithRelationInput> {
	return buildListOrder(rewardNotificationListQuery.resolveSort(query.sort), {
		columns: REWARD_NOTIFICATION_SORT_COLUMNS,
		tieBreaker: (direction) => ({ id: direction }),
	});
}

/** One notification page plus the user's total unread count (the badge). */
export interface RewardNotificationListPage {
	readonly page: RepositoryListResult<RewardNotification>;
	readonly unreadCount: number;
}

@Injectable()
export class RewardNotificationRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async listForUser(userId: string, query: RewardNotificationListQuery): Promise<RewardNotificationListPage> {
		const [page, unreadCount] = await Promise.all([
			fetchListPage(query, {
				where: buildRewardNotificationListWhere(userId, query),
				order: buildRewardNotificationListOrder(query),
				keyset: REWARD_NOTIFICATION_LIST_KEYSET,
				and: (left, right) => ({ AND: [left, right] }),
				count: (where) => this.prisma.rewardNotification.count({ where }),
				findMany: (args) => this.prisma.rewardNotification.findMany(args),
			}),
			this.prisma.rewardNotification.count({ where: { userId, isDeleted: false, readAt: null } }),
		]);
		return { page, unreadCount };
	}

	public async markAllRead(userId: string, readAt: number): Promise<void> {
		await this.prisma.rewardNotification.updateMany({
			where: { userId, readAt: null, isDeleted: false },
			data: { readAt },
		});
	}

	public async markReadByIds(userId: string, notificationIds: readonly string[], readAt: number): Promise<void> {
		await this.prisma.rewardNotification.updateMany({
			where: { userId, id: { in: [...notificationIds] }, isDeleted: false },
			data: { readAt },
		});
	}

	public async create(input: {
		readonly userId: string;
		readonly type: string;
		readonly title: string;
		readonly body: string;
		readonly metadata: Record<string, string>;
	}): Promise<void> {
		await this.prisma.rewardNotification.create({
			data: {
				userId: input.userId,
				type: input.type,
				title: input.title,
				body: input.body,
				metadata: input.metadata,
			},
		});
	}
}
