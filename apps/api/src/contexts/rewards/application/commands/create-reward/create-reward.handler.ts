import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type RewardResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { Reward } from "../../../domain/aggregates/reward.aggregate";
import { decideRewardLocationScope } from "../../../domain/policies/reward-location-scope.policy";
import { RewardRulesValue } from "../../../domain/value-objects/reward-rules.value-object";
import { MERCHANT_ACCESS } from "../../../../organizations/public-api";
import { REWARD_ID_GENERATOR, REWARDS_UNIT_OF_WORK, type IdGenerator } from "../../ports/rewards.tokens";
import type { RewardsScope } from "../../rewards-scope";
import { managerLocationIds } from "../merchant-manager-scope";
import { CreateRewardCommand } from "./create-reward.command";

/**
 * Creates a consumer reward with its images, store scope and (with referrals) its referrer child in
 * ONE transaction (D02): a failure anywhere leaves no reward row.
 */
@CommandHandler(CreateRewardCommand)
export class CreateRewardHandler implements ICommandHandler<CreateRewardCommand, RewardResponse> {
	public constructor(
		@Inject(REWARDS_UNIT_OF_WORK) private readonly uow: UnitOfWork<RewardsScope>,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(REWARD_ID_GENERATOR) private readonly ids: IdGenerator,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: CreateRewardCommand): Promise<RewardResponse> {
		const { actor, input } = command;
		const grant = await this.merchantAccess.assertCapability(actor, { organizationId: input.organizationId, capability: MERCHANT_CAPABILITY.manageRewards });

		return this.uow.run(actor, async (scope: RewardsScope): Promise<RewardResponse> => {
			const now = this.clock.now();
			const stores = await scope.stores.factsFor(input.organizationId, input.locationIds);
			const reward = Reward.create(
				{
					id: this.ids.next(),
					referrerId: this.ids.next(),
					organizationId: input.organizationId,
					title: input.title,
					description: input.description,
					offer: { rewardType: input.rewardType, rewardValue: input.rewardValue, termsConditions: input.termsConditions ?? null, category: input.category },
					rules: input.rules === undefined ? RewardRulesValue.none() : RewardRulesValue.fromApi(input.rules),
					quantityTotal: input.quantityTotal,
					startDate: input.startDate ?? null,
					expiryDate: input.expiryDate,
					referralsEnabled: input.referralsEnabled,
					referralPoolTotal: input.referralPoolTotal ?? null,
					referrerRewardTitle: input.referrerRewardTitle ?? null,
					saveAsDraft: input.saveAsDraft,
					locationScope: decideRewardLocationScope(managerLocationIds(grant), stores, { scopeType: input.locationScopeType, locationIds: input.locationIds }),
					imageFileIds: input.imageFileIds,
				},
				now,
			);
			await scope.imageFiles.lockUsable(input.organizationId, reward.imagesToBind());
			await scope.rewards.add(reward);
			scope.events.collectFrom(reward);
			return scope.views.getResponse(reward.id);
		});
	}
}
