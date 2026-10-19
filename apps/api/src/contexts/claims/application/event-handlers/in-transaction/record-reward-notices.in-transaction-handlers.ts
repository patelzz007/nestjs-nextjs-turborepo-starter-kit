import type { InTransactionEventHandler } from "../../../../../platform/application/events/in-transaction-event-handler";
import type { DomainEvent } from "../../../../../platform/domain/domain-event";
import type { OrganizationReadPort } from "../../../../organizations/public-api";
import { ReferrerCredited } from "../../../../referrals/public-api";
import { RewardApproved, RewardAutoPublished, RewardRejected } from "../../../../rewards/public-api";
import type { ClaimsScope } from "../../claims-scope";
import type { RewardNotice } from "../../ports/claims-transactional.ports";

/** Inbox type of the referrer-credit notice (byte-stable; clients render on it). */
export const REFERRER_CREDITED_NOTICE_TYPE = "referrer_reward_credited";

/** A referee's redemption credited the referrer: tell them in the checkout's own transaction. */
export class RecordNotificationOnReferrerCredited implements InTransactionEventHandler<ReferrerCredited, ClaimsScope> {
	public accepts(event: DomainEvent): event is ReferrerCredited {
		return event instanceof ReferrerCredited;
	}

	public async handle(event: ReferrerCredited, scope: ClaimsScope): Promise<void> {
		await scope.notifications.add([
			{
				userId: event.referrerUserId,
				type: REFERRER_CREDITED_NOTICE_TYPE,
				title: "You earned a referrer reward!",
				body: `Your referral redeemed a reward. Claim "${event.referrerRewardTitle}" within ${String(event.claimTtlDays)} days.`,
				metadata: { rewardId: event.referrerRewardId },
			},
		]);
	}
}

type RewardReviewDecision = RewardApproved | RewardRejected | RewardAutoPublished;

function noticeFor(event: RewardReviewDecision, ownerUserId: string): RewardNotice {
	const metadata = { rewardId: event.rewardId };
	if (event instanceof RewardApproved) {
		return { userId: ownerUserId, type: "reward_approved", title: "Reward approved", body: `"${event.title}" is now live in the marketplace.`, metadata };
	}
	if (event instanceof RewardRejected) {
		return { userId: ownerUserId, type: "reward_rejected", title: "Reward needs changes", body: event.reason, metadata };
	}
	return { userId: ownerUserId, type: "reward_auto_published", title: "Reward published", body: `"${event.title}" was auto-published after the 24h review window.`, metadata };
}

/** Every review decision tells the organization's owners, in the decision's own transaction. */
export class RecordOwnerNoticesOnRewardReview implements InTransactionEventHandler<RewardReviewDecision, ClaimsScope> {
	public constructor(private readonly organizations: OrganizationReadPort) {}

	public accepts(event: DomainEvent): event is RewardReviewDecision {
		return event instanceof RewardApproved || event instanceof RewardRejected || event instanceof RewardAutoPublished;
	}

	public async handle(event: RewardReviewDecision, scope: ClaimsScope): Promise<void> {
		const owners = await this.organizations.listOwnerUserIds(event.organizationId);
		await scope.notifications.add(owners.map((ownerUserId) => noticeFor(event, ownerUserId)));
	}
}
