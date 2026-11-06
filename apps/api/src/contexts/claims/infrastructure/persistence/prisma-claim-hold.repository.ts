import type { Prisma } from "@prisma/client";
import { EpochMsSchema, nowEpochMs, type EpochMs } from "@workspace/shared";

import { ClaimHold } from "../../domain/aggregates/claim-hold.aggregate";
import type { ClaimHoldRepository, OverdueClaimHold } from "../../domain/repositories/claims.repositories";
import { ClaimHoldStatusSchema } from "../../domain/value-objects/claim-rules.value-object";

type ClaimHoldRow = Prisma.RewardClaimHoldGetPayload<object>;

function toHold(row: ClaimHoldRow): ClaimHold {
	return ClaimHold.rehydrate({
		id: row.id,
		userId: row.userId,
		rewardId: row.rewardId,
		status: ClaimHoldStatusSchema.parse(row.status),
		expiresAt: EpochMsSchema.parse(Number(row.expiresAt)),
		settledAt: row.settledAt === null ? null : EpochMsSchema.parse(Number(row.settledAt)),
	});
}

/** Claim holds on one unit-of-work transaction. */
export class PrismaClaimHoldRepository implements ClaimHoldRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async add(hold: ClaimHold): Promise<void> {
		const state = hold.snapshot();
		await this.db.rewardClaimHold.create({
			data: { id: state.id, userId: state.userId, rewardId: state.rewardId, status: state.status, expiresAt: state.expiresAt, settledAt: state.settledAt },
		});
	}

	public async findById(holdId: string): Promise<ClaimHold | null> {
		const row = await this.db.rewardClaimHold.findFirst({ where: { id: holdId, isDeleted: false } });
		return row === null ? null : toHold(row);
	}

	public async findLive(userId: string, rewardId: string, now: EpochMs): Promise<ClaimHold | null> {
		const row = await this.db.rewardClaimHold.findFirst({
			where: { userId, rewardId, status: "ACTIVE", isDeleted: false, expiresAt: { gte: now } },
			orderBy: [{ expiresAt: "desc" }, { id: "desc" }],
		});
		return row === null ? null : toHold(row);
	}

	public countLive(userId: string, now: EpochMs): Promise<number> {
		return this.db.rewardClaimHold.count({ where: { userId, status: "ACTIVE", isDeleted: false, expiresAt: { gte: now } } });
	}

	public countTakenSince(userId: string, rewardId: string, since: EpochMs): Promise<number> {
		return this.db.rewardClaimHold.count({ where: { userId, rewardId, isDeleted: false, createdAt: { gte: since } } });
	}

	public async listOverdue(now: EpochMs, take: number): Promise<readonly OverdueClaimHold[]> {
		const rows = await this.db.rewardClaimHold.findMany({
			where: { status: "ACTIVE", isDeleted: false, expiresAt: { lt: now } },
			orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
			take,
			select: { id: true, reward: { select: { tenantId: true } } },
		});
		return rows.map((row): OverdueClaimHold => ({ holdId: row.id, tenantId: row.reward.tenantId }));
	}

	public async saveIfUnchanged(hold: ClaimHold): Promise<boolean> {
		const state = hold.snapshot();
		const updated = await this.db.rewardClaimHold.updateMany({
			where: { id: state.id, status: "ACTIVE" },
			data: { status: state.status, settledAt: state.settledAt, updatedAt: nowEpochMs() },
		});
		return updated.count === 1;
	}
}
