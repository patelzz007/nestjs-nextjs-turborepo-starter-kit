import { Injectable } from "@nestjs/common";
import type { Prisma, RewardNotification } from "@prisma/client";

import type { RewardNotificationListQuery } from "@workspace/shared";

import { fetchStringIdCursorPage } from "../../../platform/persistence/cursor-list";
import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class RewardNotificationRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async listForUser(
		userId: string,
		query: RewardNotificationListQuery,
	): Promise<{ readonly rows: RewardNotification[]; readonly unreadCount: number; readonly nextCursor: string | null; readonly hasNext: boolean }> {
		const where: Prisma.RewardNotificationWhereInput = {
			userId,
			isDeleted: false,
			...(query.unreadOnly === true ? { readAt: null } : {}),
		};

		const [result, unreadCount] = await Promise.all([
			fetchStringIdCursorPage<Prisma.RewardNotificationWhereInput, RewardNotification>({
				limit: query.limit,
				cursor: query.cursor,
				where,
				mergeCursor: (baseWhere, cursorId) => ({ ...baseWhere, id: { gt: cursorId } }),
				readId: (row) => row.id,
				findMany: (args): Promise<RewardNotification[]> => this.prisma.rewardNotification.findMany(args),
			}),
			this.prisma.rewardNotification.count({ where: { userId, isDeleted: false, readAt: null } }),
		]);

		return { rows: [...result.items], unreadCount, nextCursor: result.nextCursor, hasNext: result.hasNext };
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
