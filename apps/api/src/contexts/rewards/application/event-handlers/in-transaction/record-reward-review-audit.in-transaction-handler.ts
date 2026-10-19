import type { InTransactionEventHandler } from "../../../../../platform/application/events/in-transaction-event-handler";
import type { DomainEvent } from "../../../../../platform/domain/domain-event";
import { RewardApproved, RewardAutoPublished, RewardRejected } from "../../../domain/events/reward.events";
import type { RewardAuditEntry } from "../../ports/rewards-transactional.ports";
import type { RewardsScope } from "../../rewards-scope";

/** A review decision, by a reviewer or by the review window running out. */
type RewardReviewDecision = RewardApproved | RewardRejected | RewardAutoPublished;

function auditEntryFor(event: RewardReviewDecision): RewardAuditEntry {
	if (event instanceof RewardApproved) {
		return { organizationId: event.organizationId, actorUserId: event.reviewerUserId, action: "reward.approved", metadata: { rewardId: event.rewardId } };
	}
	if (event instanceof RewardRejected) {
		return {
			organizationId: event.organizationId,
			actorUserId: event.reviewerUserId,
			action: "reward.rejected",
			metadata: { rewardId: event.rewardId, reason: event.reason },
		};
	}
	return { organizationId: event.organizationId, actorUserId: null, action: "reward.auto_published", metadata: { rewardId: event.rewardId } };
}

/** Writes the reward audit row of every review decision in the decision's own transaction. */
export class RecordRewardReviewAuditHandler implements InTransactionEventHandler<RewardReviewDecision, RewardsScope> {
	public accepts(event: DomainEvent): event is RewardReviewDecision {
		return event instanceof RewardApproved || event instanceof RewardRejected || event instanceof RewardAutoPublished;
	}

	public async handle(event: RewardReviewDecision, scope: RewardsScope): Promise<void> {
		await scope.audit.append(auditEntryFor(event));
	}
}
