import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type RewardResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { RewardRulesValue } from "../../../domain/value-objects/reward-rules.value-object";
import { MERCHANT_ACCESS } from "../../../../tenancy/public-api";
import { REWARDS_UNIT_OF_WORK } from "../../ports/rewards.tokens";
import type { RewardsScope } from "../../rewards-scope";
import { rewardManager } from "../merchant-manager-scope";
import { ReviseRewardCommand } from "./revise-reward.command";

/**
 * A merchant's edit of a draft or pending reward (D03): the reward and its referrer child change
 * together and are saved with a compare-and-set, so an edit racing a review decision (or another
 * edit) loses with 409 instead of overwriting it.
 */
@CommandHandler(ReviseRewardCommand)
export class ReviseRewardHandler implements ICommandHandler<ReviseRewardCommand, RewardResponse> {
	public constructor(
		@Inject(REWARDS_UNIT_OF_WORK) private readonly uow: UnitOfWork<RewardsScope>,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: ReviseRewardCommand): Promise<RewardResponse> {
		const { actor, input } = command;
		const grant = await this.merchantAccess.assertCapability(actor, { tenantId: input.tenantId, capability: MERCHANT_CAPABILITY.manageRewards });

		return this.uow.run(actor, async (scope: RewardsScope): Promise<RewardResponse> => {
			const reward = await scope.rewards.getConsumerInTenant(input.tenantId, input.rewardId);
			reward.revise(
				{
					title: input.title,
					description: input.description,
					rewardType: input.rewardType,
					rewardValue: input.rewardValue,
					termsConditions: input.termsConditions,
					imageFileIds: input.imageFileIds,
					quantityTotal: input.quantityTotal,
					startDate: input.startDate,
					expiryDate: input.expiryDate,
					referralsEnabled: input.referralsEnabled,
					referralPoolTotal: input.referralPoolTotal,
					referrerRewardTitle: input.referrerRewardTitle,
					rules: input.rules === undefined ? undefined : RewardRulesValue.fromApi(input.rules),
				},
				rewardManager(actor, grant),
				this.clock.now(),
			);
			await scope.imageFiles.lockUsable(input.tenantId, reward.imagesToBind());
			await scope.rewards.save(reward);
			scope.events.collectFrom(reward);
			return scope.views.getResponse(reward.id);
		});
	}
}
