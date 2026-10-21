import type { Prisma } from "@prisma/client";
import {
	epochMs,
	MerchantRewardSummarySchema,
	RewardStatusSchema,
	type AdminPendingRewardListQuery,
	type EpochMs,
	type MerchantRewardListQuery,
	type MerchantRewardSummary,
	type PaginatedServiceResult,
	type RewardListQuery,
	type RewardResponse,
	type RewardStatus,
} from "@workspace/shared";

import type { PublicUrlResolve } from "../../../../config/public-url.resolver";
import type { ActorContext } from "../../../../platform/application/actor-context";
import type { MerchantAccessGrant } from "../../../../platform/application/ports/authorization.port";
import { fetchListPage, toPaginatedServiceResult } from "../../../../platform/infrastructure/persistence/list-page";
import type { DueForAutoPublish, RewardReadPort } from "../../application/ports/reward-read.port";
import {
	buildMarketplaceOrder,
	buildMarketplaceWhere,
	OPERATING_MERCHANT_WHERE,
	buildTenantRewardListOrder,
	buildTenantRewardListWhere,
	buildPendingReviewOrder,
	buildPendingReviewWhere,
	tenantRewardWhere,
	PENDING_REVIEW_LIST_KEYSET,
	MARKETPLACE_REWARD_SELECT,
	REWARD_RESPONSE_INCLUDE,
	rewardListKeyset,
	type MarketplaceRewardRow,
	type RewardResponseRow,
} from "./reward-list-queries";
import { mapRewardToResponse, type RewardResponseSource } from "./reward-response.mapper";
import type { TenantDisplayAdapter } from "../adapters/tenant-display.adapter";
import type { RewardsReadSession } from "./rewards-read-session";

/** Reward projections on Prisma. One include (tenant, logo, images, stores) per page — no N+1. */
export class PrismaRewardReadRepository implements RewardReadPort {
	public constructor(
		private readonly session: RewardsReadSession,
		private readonly tenants: TenantDisplayAdapter,
		private readonly resolve: PublicUrlResolve,
	) {}

	public async listTenantRewards(actor: ActorContext, grant: MerchantAccessGrant, query: MerchantRewardListQuery): Promise<PaginatedServiceResult<RewardResponse>> {
		return this.session.read(actor, async (db) => {
			const result = await fetchListPage(query, {
				where: buildTenantRewardListWhere(grant, query),
				order: buildTenantRewardListOrder(query),
				keyset: rewardListKeyset<RewardResponseRow>(),
				and: (left: Prisma.RewardWhereInput, right: Prisma.RewardWhereInput): Prisma.RewardWhereInput => ({ AND: [left, right] }),
				count: (where) => db.reward.count({ where }),
				findMany: (args): Promise<RewardResponseRow[]> => db.reward.findMany({ ...args, include: REWARD_RESPONSE_INCLUDE }),
			});
			const items = await this.toResponses(db, result.items);
			return toPaginatedServiceResult({ ...result, items }, query);
		});
	}

	public async summarizeTenantRewards(actor: ActorContext, grant: MerchantAccessGrant): Promise<MerchantRewardSummary> {
		return this.session.read(actor, async (db) => {
			// One grouped aggregate over the whole scope — never a read of the rows.
			const groups = await db.reward.groupBy({ by: ["status"], where: tenantRewardWhere(grant), _count: { _all: true }, _sum: { quantityRemaining: true } });
			const countsByStatus = Object.fromEntries(RewardStatusSchema.options.map((status: RewardStatus): [RewardStatus, number] => [status, 0]));
			let unitsRemaining = 0;
			for (const group of groups) {
				countsByStatus[group.status] = group._count._all;
				unitsRemaining += group._sum.quantityRemaining ?? 0;
			}
			return { countsByStatus: MerchantRewardSummarySchema.shape.countsByStatus.parse(countsByStatus), unitsRemaining };
		});
	}

	public async findTenantReward(actor: ActorContext, grant: MerchantAccessGrant, rewardId: string): Promise<RewardResponse | null> {
		return this.session.read(actor, async (db) =>
			this.toResponse(db, await db.reward.findFirst({ where: { AND: [tenantRewardWhere(grant), { id: rewardId }] }, include: REWARD_RESPONSE_INCLUDE })),
		);
	}

	public async listPendingReview(actor: ActorContext, query: AdminPendingRewardListQuery): Promise<PaginatedServiceResult<RewardResponse>> {
		return this.session.readAcrossTenants(actor, async (db) => {
			const result = await fetchListPage(query, {
				where: buildPendingReviewWhere(),
				order: buildPendingReviewOrder(query),
				keyset: PENDING_REVIEW_LIST_KEYSET,
				and: (left: Prisma.RewardWhereInput, right: Prisma.RewardWhereInput): Prisma.RewardWhereInput => ({ AND: [left, right] }),
				count: (where) => db.reward.count({ where }),
				findMany: (args): Promise<RewardResponseRow[]> => db.reward.findMany({ ...args, include: REWARD_RESPONSE_INCLUDE }),
			});
			const items = await this.toResponses(db, result.items);
			return toPaginatedServiceResult({ ...result, items }, query);
		});
	}

	public async findConsumerForReview(actor: ActorContext, rewardId: string): Promise<RewardResponse | null> {
		return this.session.readAcrossTenants(actor, async (db) =>
			this.toResponse(db, await db.reward.findFirst({ where: { id: rewardId, isDeleted: false, rewardKind: "CONSUMER" }, include: REWARD_RESPONSE_INCLUDE })),
		);
	}

	public async listMarketplace(actor: ActorContext, query: RewardListQuery): Promise<PaginatedServiceResult<RewardResponse>> {
		return this.session.readPublished(actor, async (db) => {
			const result = await fetchListPage(query, {
				where: buildMarketplaceWhere(query),
				order: buildMarketplaceOrder(query),
				keyset: rewardListKeyset<MarketplaceRewardRow>(),
				and: (left: Prisma.RewardWhereInput, right: Prisma.RewardWhereInput): Prisma.RewardWhereInput => ({ AND: [left, right] }),
				count: (where) => db.reward.count({ where }),
				findMany: (args): Promise<MarketplaceRewardRow[]> => db.reward.findMany({ ...args, select: MARKETPLACE_REWARD_SELECT }),
			});
			const items = await this.toResponses(db, result.items);
			return toPaginatedServiceResult({ ...result, items }, query);
		});
	}

	public async findPublished(actor: ActorContext, rewardId: string): Promise<RewardResponse | null> {
		return this.session.readPublished(actor, async (db) =>
			this.toResponse(
				db,
				await db.reward.findFirst({
					where: { AND: [{ id: rewardId, isDeleted: false, status: "PUBLISHED", rewardKind: "CONSUMER" }, OPERATING_MERCHANT_WHERE] },
					select: MARKETPLACE_REWARD_SELECT,
				}),
			),
		);
	}

	public async listDueForAutoPublish(actor: ActorContext, now: EpochMs, limit: number, after: DueForAutoPublish | null): Promise<readonly DueForAutoPublish[]> {
		const due: Prisma.RewardWhereInput = { status: "PENDING_REVIEW", autoPublishAt: { lte: now }, isDeleted: false, rewardKind: "CONSUMER" };
		const rows = await this.session.read(actor, async (db) =>
			db.reward.findMany({
				where:
					after === null ? due : { AND: [due, { OR: [{ autoPublishAt: { gt: after.autoPublishAt } }, { autoPublishAt: after.autoPublishAt, id: { gt: after.rewardId } }] }] },
				select: { id: true, autoPublishAt: true },
				orderBy: [{ autoPublishAt: "asc" }, { id: "asc" }],
				take: limit,
			}),
		);
		return rows.flatMap((row): DueForAutoPublish[] => (row.autoPublishAt === null ? [] : [{ rewardId: row.id, autoPublishAt: epochMs(Number(row.autoPublishAt)) }]));
	}

	/** One page of rewards, with their merchants' display data fetched once for the whole page. */
	private async toResponses(db: Prisma.TransactionClient, rows: readonly RewardResponseSource[]): Promise<RewardResponse[]> {
		const tenants = await this.tenants.displayData(rows.map((row) => row.tenantId));
		return rows.map((row) => mapRewardToResponse(row, tenants.get(row.tenantId), this.resolve));
	}

	private async toResponse(db: Prisma.TransactionClient, row: RewardResponseSource | null): Promise<RewardResponse | null> {
		if (row === null) {
			return null;
		}
		const [response] = await this.toResponses(db, [row]);
		return response ?? null;
	}
}
