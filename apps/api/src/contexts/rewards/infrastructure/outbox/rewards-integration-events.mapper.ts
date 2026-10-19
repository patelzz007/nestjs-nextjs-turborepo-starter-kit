import { RewardPlatformEventSchema, type PlatformEventInput, type RewardPlatformEvent } from "@workspace/shared";

import type { IntegrationEventMapper } from "../../../../platform/application/events/integration-event-mapper";
import type { DomainEvent } from "../../../../platform/domain/domain-event";
import { RewardApproved, RewardAutoPublished, RewardRejected } from "../../domain/events/reward.events";

function rewardPlatform(payload: RewardPlatformEvent): PlatformEventInput {
	return { type: "reward.platform", payload: RewardPlatformEventSchema.parse(payload) };
}

/**
 * Mechanism 3: review decisions become `reward.platform` outbox records in the decision's own
 * transaction. `reward.auto_published` keeps its existing payload; `reward.approved` and
 * `reward.rejected` are new (D01). Other reward events stay in-process.
 */
export class RewardsIntegrationEventsMapper implements IntegrationEventMapper {
	public map(event: DomainEvent): PlatformEventInput | null {
		if (event instanceof RewardApproved) {
			return rewardPlatform({ event: "reward.approved", actorUserId: event.reviewerUserId, organizationId: event.organizationId, metadata: { rewardId: event.rewardId } });
		}
		if (event instanceof RewardRejected) {
			return rewardPlatform({ event: "reward.rejected", actorUserId: event.reviewerUserId, organizationId: event.organizationId, metadata: { rewardId: event.rewardId } });
		}
		if (event instanceof RewardAutoPublished) {
			return rewardPlatform({ event: "reward.auto_published", actorUserId: null, organizationId: event.organizationId, metadata: { rewardId: event.rewardId } });
		}
		return null;
	}
}
