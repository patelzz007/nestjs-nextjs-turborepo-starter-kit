import type { Prisma } from "@prisma/client";
import { epochMs, type EpochMs } from "@workspace/shared";
import { z } from "zod";

import type { CountedRedemption } from "../../domain/policies/tier-window.policy";

const CountedRedemptionRowSchema = z.object({ tenantId: z.string().min(1), redeemedAt: z.bigint() });

/**
 * The customer's counted redemptions made after `since`, oldest first (ADR 085): their live redemptions, minus those
 * made while they were a member of that merchant. A membership covers a redemption from when it was created until it was
 * soft-deleted (a live membership has no end), so joining or leaving a merchant's staff later changes nothing already
 * counted. Raw SQL: Prisma cannot say "a membership of this redemption's tenant that covered its moment".
 */
export async function countedRedemptionsSince(db: Prisma.TransactionClient, userId: string, since: EpochMs): Promise<readonly CountedRedemption[]> {
	const rows = await db.$queryRaw`
		SELECT r."tenantId", r."redeemedAt"
		FROM "RewardRedemption" r
		WHERE r."userId" = ${userId}
		  AND r."isDeleted" = false
		  AND r."redeemedAt" > ${BigInt(since)}
		  AND NOT EXISTS (
		    SELECT 1 FROM "Membership" m
		    WHERE m."tenantId" = r."tenantId"
		      AND m."userId" = r."userId"
		      AND m."createdAt" <= r."redeemedAt"
		      AND (m."isDeleted" = false OR (m."deletedAt" IS NOT NULL AND m."deletedAt" > r."redeemedAt"))
		  )
		ORDER BY r."redeemedAt" ASC, r.id ASC`;
	return CountedRedemptionRowSchema.array()
		.parse(rows)
		.map((row): CountedRedemption => ({ tenantId: row.tenantId, redeemedAt: epochMs(Number(row.redeemedAt)) }));
}
