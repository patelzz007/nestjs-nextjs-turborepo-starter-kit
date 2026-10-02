import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { nowEpochMs } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class SessionUserRepository {
	public constructor(private readonly prisma: PrismaService) {}

	/** Invalidate every issued access token of `userIds` (pass `db` to join a caller's transaction). */
	public async bumpTokenVersions(userIds: readonly string[], db: Prisma.TransactionClient = this.prisma): Promise<void> {
		if (userIds.length === 0) {
			return;
		}
		const now: number = nowEpochMs();
		await db.user.updateMany({
			where: { id: { in: [...userIds] } },
			data: { tokenVersion: { increment: 1 }, updatedAt: now },
		});
	}
}
