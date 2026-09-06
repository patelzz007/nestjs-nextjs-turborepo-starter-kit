import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class RewardAuditLogRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async create(data: Prisma.RewardAuditLogUncheckedCreateInput): Promise<void> {
		await this.prisma.rewardAuditLog.create({ data });
	}
}
