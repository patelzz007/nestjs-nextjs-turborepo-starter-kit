import { Injectable } from "@nestjs/common";
import type { Prisma, PrismaClient } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

export type RewardAuditLogDbClient = Pick<PrismaClient, "rewardAuditLog">;

/**
 * Appends one reward audit row without reading it back. Audit rows are write-only for most
 * principals (an API key may insert its organization's rows but never read them), and Prisma's
 * `create()` issues `INSERT … RETURNING`, which Postgres also checks against the SELECT policies.
 * `createMany` inserts without `RETURNING`, so the write needs only the INSERT policy.
 */
export async function appendRewardAuditLog(db: RewardAuditLogDbClient, data: Prisma.RewardAuditLogCreateManyInput): Promise<void> {
	await db.rewardAuditLog.createMany({ data: [data] });
}

@Injectable()
export class RewardAuditLogRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async create(data: Prisma.RewardAuditLogCreateManyInput, db: RewardAuditLogDbClient = this.prisma): Promise<void> {
		await appendRewardAuditLog(db, data);
	}
}
