import type { Prisma } from "@prisma/client";
import type { RewardClaimResponse } from "@workspace/shared";

import type { ClaimViewPort } from "../../application/ports/claims-transactional.ports";
import { ClaimNotFoundError } from "../../domain/errors/claims.errors";
import { toRewardClaimResponse } from "./claim-row.mappers";

/** A claim as the API returns it, read in the command's own transaction (so it sees the command's write). */
export class PrismaClaimView implements ClaimViewPort {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async getResponse(claimId: string): Promise<RewardClaimResponse> {
		const row = await this.db.rewardClaim.findFirst({ where: { id: claimId, isDeleted: false }, include: { reward: { select: { title: true } } } });
		if (row === null) {
			throw new ClaimNotFoundError(claimId);
		}
		return toRewardClaimResponse(row, row.reward.title);
	}
}
