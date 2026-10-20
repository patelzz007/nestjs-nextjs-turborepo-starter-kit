import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { RewardResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { REWARDS_UNIT_OF_WORK, REWARDS_ADMIN_REVIEW_OPERATION } from "../../ports/rewards.tokens";
import type { RewardsScope } from "../../rewards-scope";
import { actingUserId } from "../acting-user";
import { RejectRewardCommand } from "./reject-reward.command";

/** A reviewer returns a pending reward to draft (D01), compared-and-set like {@link ApproveRewardHandler}. */
@CommandHandler(RejectRewardCommand)
export class RejectRewardHandler implements ICommandHandler<RejectRewardCommand, RewardResponse> {
	public constructor(
		@Inject(REWARDS_UNIT_OF_WORK) private readonly uow: UnitOfWork<RewardsScope>,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RejectRewardCommand): Promise<RewardResponse> {
		const { actor, input } = command;
		const reviewerUserId = actingUserId(actor);

		return this.uow.runSystemOperation(REWARDS_ADMIN_REVIEW_OPERATION, actor, async (scope: RewardsScope): Promise<RewardResponse> => {
			const reward = await scope.rewards.getConsumer(input.rewardId);
			reward.reject(reviewerUserId, input.reason, this.clock.now());
			await scope.rewards.save(reward);
			scope.events.collectFrom(reward);
			return scope.views.getResponse(reward.id);
		});
	}
}
