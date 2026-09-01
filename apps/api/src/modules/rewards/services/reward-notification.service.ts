import { Injectable } from "@nestjs/common";

import type { RewardNotificationListQuery, RewardNotificationResponse } from "@workspace/shared";
import { EpochMsSchema } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class RewardNotificationService {
	public constructor(private readonly prisma: PrismaService) {}

	public async listForUser(userId: string, query: RewardNotificationListQuery): Promise<{ items: RewardNotificationResponse[]; unreadCount: number }> {
		const page = query.page;
		const limit = query.limit;
		const skip = (page - 1) * limit;

		const where = {
			userId,
			isDeleted: false,
			...(query.unreadOnly === true ? { readAt: null } : {}),
		};

		const [rows, unreadCount] = await this.prisma.$transaction([
			this.prisma.rewardNotification.findMany({
				where,
				orderBy: { createdAt: "desc" },
				skip,
				take: limit,
			}),
			this.prisma.rewardNotification.count({ where: { userId, isDeleted: false, readAt: null } }),
		]);

		return {
			items: rows.map((row) => this.map(row)),
			unreadCount,
		};
	}

	public async markRead(userId: string, notificationIds: string[] | undefined, markAll: boolean | undefined): Promise<{ ok: true }> {
		const now = Date.now();
		if (markAll === true) {
			await this.prisma.rewardNotification.updateMany({
				where: { userId, readAt: null, isDeleted: false },
				data: { readAt: now },
			});
			return { ok: true };
		}

		if (notificationIds !== undefined && notificationIds.length > 0) {
			await this.prisma.rewardNotification.updateMany({
				where: { userId, id: { in: notificationIds }, isDeleted: false },
				data: { readAt: now },
			});
		}

		return { ok: true };
	}

	public async notify(userId: string, type: string, title: string, body: string, metadata: Record<string, string>): Promise<void> {
		await this.prisma.rewardNotification.create({
			data: {
				userId,
				type,
				title,
				body,
				metadata,
			},
		});
	}

	private map(row: {
		id: string;
		type: string;
		title: string;
		body: string;
		readAt: bigint | number | null;
		metadata: unknown;
		createdAt: bigint | number;
		updatedAt: bigint | number;
		isDeleted: boolean;
		deletedAt: bigint | number | null;
	}): RewardNotificationResponse {
		return {
			id: row.id,
			type: row.type,
			title: row.title,
			body: row.body,
			readAt: row.readAt === null ? null : EpochMsSchema.parse(Number(row.readAt)),
			metadata: row.metadata === null ? null : (row.metadata as RewardNotificationResponse["metadata"]),
			createdAt: EpochMsSchema.parse(Number(row.createdAt)),
			updatedAt: EpochMsSchema.parse(Number(row.updatedAt)),
			isDeleted: row.isDeleted,
			deletedAt: row.deletedAt === null ? null : EpochMsSchema.parse(Number(row.deletedAt)),
		};
	}
}
