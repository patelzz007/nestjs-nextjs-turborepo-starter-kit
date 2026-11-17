import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type RewardResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import { CUSTOMER_TIER_ACCESS, type CustomerTierAccessPort } from "../../../../../platform/application/ports/customer-tier-access.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { MERCHANT_ACCESS } from "../../../../tenancy/public-api";
import type { RewardMerchantDisplayPort } from "../../ports/reward-merchant-display.port";
import { REWARD_MERCHANT_DISPLAY, REWARDS_UNIT_OF_WORK } from "../../ports/rewards.tokens";
import type { RewardsScope } from "../../rewards-scope";
import { rewardManager } from "../merchant-manager-scope";
import { assertMinimumTierAvailable } from "../minimum-tier-availability";
import { SetRewardMinimumTierCommand } from "./set-reward-minimum-tier.command";

/**
 * A merchant changes who may claim a reward (ADR 085), saved with the reward's compare-and-set like any edit: a draft, a
 * reward in review or a published one, without sending it back to review. Claims already made stand.
 */
@CommandHandler(SetRewardMinimumTierCommand)
export class SetRewardMinimumTierHandler implements ICommandHandler<SetRewardMinimumTierCommand, RewardResponse> {
	public constructor(
		@Inject(REWARDS_UNIT_OF_WORK) private readonly uow: UnitOfWork<RewardsScope>,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(CLOCK) private readonly clock: Clock,
		@Inject(REWARD_MERCHANT_DISPLAY) private readonly merchantDisplay: RewardMerchantDisplayPort,
		@Inject(CUSTOMER_TIER_ACCESS) private readonly tiers: Pick<CustomerTierAccessPort, "accessFor">,
	) {}

	public async execute(command: SetRewardMinimumTierCommand): Promise<RewardResponse> {
		const { actor, input } = command;
		const grant = await this.merchantAccess.assertCapability(actor, { tenantId: input.tenantId, capability: MERCHANT_CAPABILITY.manageRewards });
		await assertMinimumTierAvailable(this.tiers, input.minimumTier);

		// The merchant's name and logo after the commit (a read of its own: not inside this transaction).
		return this.merchantDisplay.withMerchantDisplay(
			await this.uow.run(actor, async (scope: RewardsScope): Promise<RewardResponse> => {
				const reward = await scope.rewards.getConsumerInTenant(input.tenantId, input.rewardId);
				reward.changeMinimumTier(input.minimumTier, rewardManager(actor, grant), this.clock.now());
				await scope.rewards.save(reward);
				scope.events.collectFrom(reward);
				return scope.views.getResponse(reward.id);
			}),
		);
	}
}
