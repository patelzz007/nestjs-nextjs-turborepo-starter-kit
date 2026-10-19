import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type RewardResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { MERCHANT_ACCESS } from "../../../../organizations/public-api";
import { REWARDS_UNIT_OF_WORK } from "../../ports/rewards.tokens";
import type { RewardsScope } from "../../rewards-scope";
import { rewardManager } from "../merchant-manager-scope";
import { SubmitRewardForReviewCommand } from "./submit-reward-for-review.command";

/** Draft → pending review for the reward and its referrer child in one compare-and-set (D04). */
@CommandHandler(SubmitRewardForReviewCommand)
export class SubmitRewardForReviewHandler implements ICommandHandler<SubmitRewardForReviewCommand, RewardResponse> {
	public constructor(
		@Inject(REWARDS_UNIT_OF_WORK) private readonly uow: UnitOfWork<RewardsScope>,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: SubmitRewardForReviewCommand): Promise<RewardResponse> {
		const { actor, input } = command;
		const grant = await this.merchantAccess.assertCapability(actor, { organizationId: input.organizationId, capability: MERCHANT_CAPABILITY.manageRewards });

		return this.uow.run(actor, async (scope: RewardsScope): Promise<RewardResponse> => {
			const reward = await scope.rewards.getConsumerInOrganization(input.organizationId, input.rewardId);
			reward.submitForReview(rewardManager(actor, grant), this.clock.now());
			await scope.rewards.save(reward);
			scope.events.collectFrom(reward);
			return scope.views.getResponse(reward.id);
		});
	}
}
