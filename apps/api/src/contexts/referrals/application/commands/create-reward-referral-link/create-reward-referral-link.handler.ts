import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { REWARD_REFERRAL_OPEN_LINK_LIMIT, type RewardReferralLinkResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { ReferralLinkLimitReachedError, RewardNotReferableError } from "../../../domain/errors/reward-referral.errors";
import { decideReferralLink } from "../../../domain/policies/reward-referral-link.policy";
import { actingUserId } from "../../acting-user";
import type { ReferralLinkIdentityGenerator, RewardReferralLinkTransactions } from "../../ports/reward-referral-links.port";
import { REFERRAL_LINK_IDENTITY_GENERATOR, REWARD_REFERRAL_LINK_TRANSACTIONS } from "../../ports/referrals.tokens";
import { CreateRewardReferralLinkCommand } from "./create-reward-referral-link.command";

/**
 * A new PENDING `RewardReferral` of the caller for the reward, carrying a fresh attribution token.
 * Each link credits one referee, so a referrer mints one per person they share with, up to the cap
 * of unused links. The referrer row is locked first, so concurrent requests cannot pass the cap.
 */
@CommandHandler(CreateRewardReferralLinkCommand)
export class CreateRewardReferralLinkHandler implements ICommandHandler<CreateRewardReferralLinkCommand, RewardReferralLinkResponse> {
	public constructor(
		@Inject(REWARD_REFERRAL_LINK_TRANSACTIONS) private readonly links: RewardReferralLinkTransactions,
		@Inject(REFERRAL_LINK_IDENTITY_GENERATOR) private readonly identities: ReferralLinkIdentityGenerator,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: CreateRewardReferralLinkCommand): Promise<RewardReferralLinkResponse> {
		const referrerUserId = actingUserId(command.actor);
		const { rewardId } = command;
		const now = this.clock.now();
		return this.links.createLink(referrerUserId, async (scope): Promise<RewardReferralLinkResponse> => {
			if (!(await scope.lockReferrer(referrerUserId))) {
				throw new RewardNotReferableError();
			}
			const decision = decideReferralLink({
				rewardIsReferable: await scope.rewards.isReferable(rewardId, now),
				openLinks: await scope.countOpenLinks(referrerUserId, rewardId),
			});
			if (decision === "not_referable") {
				throw new RewardNotReferableError();
			}
			if (decision === "limit_reached") {
				throw new ReferralLinkLimitReachedError(REWARD_REFERRAL_OPEN_LINK_LIMIT);
			}
			const { referralId, attributionToken } = this.identities.next();
			await scope.insertLink({ referralId, referrerUserId, rewardId, attributionToken, now });
			return { referralId, rewardId, attributionToken };
		});
	}
}
