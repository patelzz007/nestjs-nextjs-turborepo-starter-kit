import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { epochMs, MERCHANT_CAPABILITY, rewardCustomerListQuery, type PaginatedServiceResult, type RewardCustomer } from "@workspace/shared";

import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import { CUSTOMER_TIER_ACCESS, type CustomerTierAccessPort } from "../../../../../platform/application/ports/customer-tier-access.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { MERCHANT_ACCESS, type TenantCustomerSummary } from "../../../../tenancy/public-api";
import { REWARD_CUSTOMERS_READ_OPERATION, REWARDS_UNIT_OF_WORK } from "../../ports/rewards.tokens";
import type { RewardsScope } from "../../rewards-scope";
import { ListRewardCustomersQuery } from "./list-reward-customers.query";

/**
 * Customers as the reward editor shows them, each with their tier (ADR 085) — just the tier, nothing behind it; null for
 * every customer while tiers are off.
 */
export async function toRewardCustomers(summaries: readonly TenantCustomerSummary[], tiers: Pick<CustomerTierAccessPort, "tiersOf">): Promise<RewardCustomer[]> {
	const tierOf = await tiers.tiersOf(summaries.map((summary) => summary.userId));
	return summaries.map((summary): RewardCustomer => ({
		userId: summary.userId,
		fullName: summary.fullName,
		maskedEmail: summary.maskedEmail,
		lastClaimedAt: epochMs(summary.lastClaimedAt),
		claimCount: summary.claimCount,
		tier: tierOf === null ? null : (tierOf.get(summary.userId) ?? null),
	}));
}

/** The tenant's customers, to give a reward to (people who manage rewards only; masked contact details). */
@QueryHandler(ListRewardCustomersQuery)
export class ListRewardCustomersHandler implements IQueryHandler<ListRewardCustomersQuery, PaginatedServiceResult<RewardCustomer>> {
	public constructor(
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(REWARDS_UNIT_OF_WORK) private readonly uow: UnitOfWork<RewardsScope>,
		@Inject(CUSTOMER_TIER_ACCESS) private readonly tiers: Pick<CustomerTierAccessPort, "tiersOf">,
	) {}

	public async execute(query: ListRewardCustomersQuery): Promise<PaginatedServiceResult<RewardCustomer>> {
		const { actor, input } = query;
		await this.merchantAccess.assertCapability(actor, { tenantId: input.tenantId, capability: MERCHANT_CAPABILITY.manageRewards });
		const [sort] = rewardCustomerListQuery.resolveSort(input.sort).terms;
		const page = await this.uow.runSystemOperation(REWARD_CUSTOMERS_READ_OPERATION, actor, (scope) =>
			scope.customers.page(input.tenantId, {
				search: input.search ?? null,
				sortField: sort?.field ?? "lastClaimedAt",
				descending: sort?.direction !== "asc",
				page: input.page,
				limit: input.limit,
			}),
		);
		const totalPages = Math.max(1, Math.ceil(page.total / input.limit));
		return {
			items: await toRewardCustomers(page.items, this.tiers),
			limit: input.limit,
			total: page.total,
			page: input.page,
			totalPages,
			nextCursor: null,
			hasNext: input.page < totalPages,
			hasPrevious: input.page > 1,
		};
	}
}
