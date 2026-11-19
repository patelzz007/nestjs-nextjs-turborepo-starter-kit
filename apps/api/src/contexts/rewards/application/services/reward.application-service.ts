import { Inject, Injectable } from "@nestjs/common";
import type { AdminPendingRewardListQuery, AdminRewardPathInput, PaginatedServiceResult, RewardResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { RewardNotFoundError } from "../../domain/errors/reward.errors";
import type { RewardReadPort } from "../ports/reward-read.port";
import { REWARD_READS } from "../ports/rewards.tokens";

/** The reads of one reward or the review queue (ADR 096). A reward the caller may not see is a 404. */
@Injectable()
export class RewardApplicationService {
	public constructor(@Inject(REWARD_READS) private readonly reads: RewardReadPort) {}

	/** A published reward, as the marketplace shows it. */
	public async getPublished(actor: ActorContext, input: { readonly rewardId: string }): Promise<RewardResponse> {
		const reward = await this.reads.findPublished(actor, input.rewardId);
		if (reward === null) {
			throw new RewardNotFoundError(input.rewardId);
		}
		return reward;
	}

	/** One reward as the platform reviewer sees it. */
	public async getForReview(actor: ActorContext, input: AdminRewardPathInput): Promise<RewardResponse> {
		const reward = await this.reads.findConsumerForReview(actor, input.rewardId);
		if (reward === null) {
			throw new RewardNotFoundError(input.rewardId);
		}
		return reward;
	}

	/** One page of the rewards waiting for review. */
	public listPendingReview(actor: ActorContext, input: AdminPendingRewardListQuery): Promise<PaginatedServiceResult<RewardResponse>> {
		return this.reads.listPendingReview(actor, input);
	}
}
