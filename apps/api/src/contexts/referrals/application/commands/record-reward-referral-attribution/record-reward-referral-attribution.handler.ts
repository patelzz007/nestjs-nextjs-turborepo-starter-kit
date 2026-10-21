import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { RewardReferralAttributionResponse } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { ReferralLinkInvalidError, ReferralOwnLinkError } from "../../../domain/errors/reward-referral.errors";
import { attributionExpiresAt, decideReferralAttribution } from "../../../domain/policies/reward-referral-link.policy";
import { actingUserId } from "../../acting-user";
import type { RewardReferralLinkTransactions } from "../../ports/reward-referral-links.port";
import { REWARD_REFERRAL_LINK_TRANSACTIONS } from "../../ports/referrals.tokens";
import { RecordRewardReferralAttributionCommand } from "./record-reward-referral-attribution.command";

/**
 * Stores a valid link's token as the caller's pending attribution (the latest link opened wins).
 * The claim handler reads it, attaches the caller to the referral when they claim that reward
 * within the window, and clears it. The referral row itself is not touched here: nothing is
 * credited until the referee claims and redeems.
 */
@CommandHandler(RecordRewardReferralAttributionCommand)
export class RecordRewardReferralAttributionHandler implements ICommandHandler<RecordRewardReferralAttributionCommand, RewardReferralAttributionResponse> {
	public constructor(
		@Inject(REWARD_REFERRAL_LINK_TRANSACTIONS) private readonly links: RewardReferralLinkTransactions,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RecordRewardReferralAttributionCommand): Promise<RewardReferralAttributionResponse> {
		const refereeUserId = actingUserId(command.actor);
		const { attributionToken } = command;
		const now = this.clock.now();
		return this.links.recordAttribution(refereeUserId, async (scope): Promise<RewardReferralAttributionResponse> => {
			const link = await scope.findLink(attributionToken);
			const decision = decideReferralAttribution(link, refereeUserId);
			if (link === null || decision === "invalid") {
				throw new ReferralLinkInvalidError();
			}
			if (decision === "own_link") {
				throw new ReferralOwnLinkError();
			}
			const expiresAt = attributionExpiresAt(now);
			if (!(await scope.referees.setPending(refereeUserId, attributionToken, expiresAt, now))) {
				throw new ReferralLinkInvalidError();
			}
			return { rewardId: link.rewardId, expiresAt };
		});
	}
}
