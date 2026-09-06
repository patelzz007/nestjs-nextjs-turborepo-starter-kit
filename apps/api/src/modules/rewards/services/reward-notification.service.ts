import { Injectable } from "@nestjs/common";
import type { RewardNotification } from "@prisma/client";

import type { RewardNotificationListQuery, RewardNotificationResponse } from "@workspace/shared";
import { EpochMsSchema, JsonObjectSchema } from "@workspace/shared";

import { RewardNotificationRepository } from "../repositories/reward-notification.repository";

@Injectable()
export class RewardNotificationService {
	public constructor(private readonly notificationRepository: RewardNotificationRepository) {}

	public async listForUser(userId: string, query: RewardNotificationListQuery): Promise<{ items: RewardNotificationResponse[]; unreadCount: number }> {
		const { rows, unreadCount } = await this.notificationRepository.listForUser(userId, query);

		return {
			items: rows.map((row) => this.map(row)),
			unreadCount,
		};
	}

	public async markRead(userId: string, notificationIds: string[] | undefined, markAll: boolean | undefined): Promise<{ ok: true }> {
		const now = Date.now();
		if (markAll === true) {
			await this.notificationRepository.markAllRead(userId, now);
			return { ok: true };
		}

		if (notificationIds !== undefined && notificationIds.length > 0) {
			await this.notificationRepository.markReadByIds(userId, notificationIds, now);
		}

		return { ok: true };
	}

	public async notify(userId: string, type: string, title: string, body: string, metadata: Record<string, string>): Promise<void> {
		await this.notificationRepository.create({ userId, type, title, body, metadata });
	}

	private map(row: RewardNotification): RewardNotificationResponse {
		const metadata = row.metadata === null ? null : JsonObjectSchema.nullable().parse(row.metadata);

		return {
			id: row.id,
			type: row.type,
			title: row.title,
			body: row.body,
			readAt: row.readAt === null ? null : EpochMsSchema.parse(Number(row.readAt)),
			metadata,
			createdAt: EpochMsSchema.parse(Number(row.createdAt)),
			updatedAt: EpochMsSchema.parse(Number(row.updatedAt)),
			isDeleted: row.isDeleted,
			deletedAt: row.deletedAt === null ? null : EpochMsSchema.parse(Number(row.deletedAt)),
		};
	}
}
