import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { epochMs, MERCHANT_CAPABILITY, rewardCustomerListQuery, type PaginatedServiceResult, type RewardCustomer } from "@workspace/shared";

import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { MERCHANT_ACCESS, type TenantCustomerSummary } from "../../../../tenancy/public-api";
import { REWARD_CUSTOMERS_READ_OPERATION, REWARDS_UNIT_OF_WORK } from "../../ports/rewards.tokens";
import type { RewardsScope } from "../../rewards-scope";
import { ListRewardCustomersQuery } from "./list-reward-customers.query";

/** A customer as the reward editor shows them. */
export function toRewardCustomer(summary: TenantCustomerSummary): RewardCustomer {
	return {
		userId: summary.userId,
		fullName: summary.fullName,
		maskedEmail: summary.maskedEmail,
		lastClaimedAt: epochMs(summary.lastClaimedAt),
		claimCount: summary.claimCount,
	};
}

/** The tenant's customers, to give a reward to (people who manage rewards only; masked contact details). */
@QueryHandler(ListRewardCustomersQuery)
export class ListRewardCustomersHandler implements IQueryHandler<ListRewardCustomersQuery, PaginatedServiceResult<RewardCustomer>> {
	public constructor(
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(REWARDS_UNIT_OF_WORK) private readonly uow: UnitOfWork<RewardsScope>,
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
			items: page.items.map(toRewardCustomer),
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
