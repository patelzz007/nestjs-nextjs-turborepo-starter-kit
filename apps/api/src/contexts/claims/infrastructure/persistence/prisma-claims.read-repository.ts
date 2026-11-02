import type { Prisma } from "@prisma/client";
import type { PaginatedServiceResult, RewardClaimListQuery, RewardClaimResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { fetchListPage, mapListResult, toPaginatedServiceResult } from "../../../../platform/infrastructure/persistence/list-page";
import type { PrismaReadExecutor } from "../../../../platform/infrastructure/unit-of-work/prisma-read-executor";
import type { ClaimReadPort } from "../../application/ports/claims-read.port";
import { buildRewardClaimListOrder, buildRewardClaimListWhere, REWARD_CLAIM_LIST_KEYSET } from "./claim-list-queries";
import { toRewardClaimResponse } from "./claim-row.mappers";

const CLAIM_WITH_REWARD_TITLE = { reward: { select: { title: true } } } satisfies Prisma.RewardClaimInclude;

type ClaimWithRewardTitle = Prisma.RewardClaimGetPayload<{ include: typeof CLAIM_WITH_REWARD_TITLE }>;

/** The customer's own claims, read under the caller's RLS session (a claimed reward stays readable to its holder). */
export class PrismaClaimReadRepository implements ClaimReadPort {
	public constructor(private readonly reads: PrismaReadExecutor<Prisma.TransactionClient>) {}

	public async listForUser(actor: ActorContext, userId: string, query: RewardClaimListQuery): Promise<PaginatedServiceResult<RewardClaimResponse>> {
		return this.reads.read(actor, async (db: Prisma.TransactionClient): Promise<PaginatedServiceResult<RewardClaimResponse>> => {
			const page = await fetchListPage(query, {
				where: buildRewardClaimListWhere(userId, query),
				order: buildRewardClaimListOrder(query),
				keyset: REWARD_CLAIM_LIST_KEYSET,
				and: (left: Prisma.RewardClaimWhereInput, right: Prisma.RewardClaimWhereInput): Prisma.RewardClaimWhereInput => ({ AND: [left, right] }),
				count: (where: Prisma.RewardClaimWhereInput): Promise<number> => db.rewardClaim.count({ where }),
				findMany: (args): Promise<ClaimWithRewardTitle[]> => db.rewardClaim.findMany({ ...args, include: CLAIM_WITH_REWARD_TITLE }),
			});
			return toPaginatedServiceResult(
				mapListResult(page, (row: ClaimWithRewardTitle): RewardClaimResponse => toRewardClaimResponse(row, row.reward.title)),
				query,
			);
		});
	}

	public async findForUser(actor: ActorContext, userId: string, claimId: string): Promise<RewardClaimResponse | null> {
		return this.reads.read(actor, async (db: Prisma.TransactionClient): Promise<RewardClaimResponse | null> => {
			const row = await db.rewardClaim.findFirst({ where: { id: claimId, userId, isDeleted: false }, include: CLAIM_WITH_REWARD_TITLE });
			return row === null ? null : toRewardClaimResponse(row, row.reward.title);
		});
	}
}

/** The customer's reward inbox, one page at a time (the unread badge is the same list filtered to `readAt` null). */
