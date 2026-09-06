import { Injectable } from "@nestjs/common";

import { nowEpochMs } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class SessionUserRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async bumpTokenVersions(userIds: readonly string[]): Promise<void> {
		if (userIds.length === 0) {
			return;
		}
		const now: number = nowEpochMs();
		await this.prisma.user.updateMany({
			where: { id: { in: [...userIds] } },
			data: { tokenVersion: { increment: 1 }, updatedAt: now },
		});
	}
}
