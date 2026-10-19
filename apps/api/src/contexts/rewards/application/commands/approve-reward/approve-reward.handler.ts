import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { RewardResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { REWARDS_UNIT_OF_WORK, ROUTE_RLS_BYPASS_OPERATION } from "../../ports/rewards.tokens";
import type { RewardsScope } from "../../rewards-scope";
import { actingUserId } from "../acting-user";
import { ApproveRewardCommand } from "./approve-reward.command";

/**
 * A reviewer publishes a pending reward (D01). The status is compared-and-set inside the
 * transaction, so approve racing reject (or a merchant's edit) leaves exactly one winner; the
 * `reward.approved` outbox record, the reward audit row and the owners' inbox notices commit with it.
 */
@CommandHandler(ApproveRewardCommand)
export class ApproveRewardHandler implements ICommandHandler<ApproveRewardCommand, RewardResponse> {
	public constructor(
		@Inject(REWARDS_UNIT_OF_WORK) private readonly uow: UnitOfWork<RewardsScope>,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: ApproveRewardCommand): Promise<RewardResponse> {
		const { actor, input } = command;
		const reviewerUserId = actingUserId(actor);

		return this.uow.runSystemOperation(ROUTE_RLS_BYPASS_OPERATION, actor, async (scope: RewardsScope): Promise<RewardResponse> => {
			const reward = await scope.rewards.getConsumer(input.rewardId);
			reward.approve(reviewerUserId, this.clock.now());
			await scope.rewards.save(reward);
			scope.events.collectFrom(reward);
			return scope.views.getResponse(reward.id);
		});
	}
}
