import { Injectable } from "@nestjs/common";
import type { Prisma, PrismaClient } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

export type RewardAuditLogDbClient = Pick<PrismaClient, "rewardAuditLog">;

@Injectable()
export class RewardAuditLogRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async create(data: Prisma.RewardAuditLogUncheckedCreateInput, db: RewardAuditLogDbClient = this.prisma): Promise<void> {
		await db.rewardAuditLog.create({ data });
	}
}
