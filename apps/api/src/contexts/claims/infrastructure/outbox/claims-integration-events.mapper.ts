import { RewardPlatformEventSchema, type PlatformEventInput } from "@workspace/shared";

import type { IntegrationEventMapper } from "../../../../platform/application/events/integration-event-mapper";
import type { DomainEvent } from "../../../../platform/domain/domain-event";
import { ClaimExpired } from "../../domain/events/claim.events";

/**
 * Claims' outbox records (mechanism 3): an expired claim feeds the `reward.platform` analytics stream
 * as `reward.claim_expired`, byte-compatible with what the legacy expiry job wrote.
 */
export class ClaimsIntegrationEventsMapper implements IntegrationEventMapper {
	public map(event: DomainEvent): PlatformEventInput | null {
		if (event instanceof ClaimExpired) {
			return {
				type: "reward.platform",
				payload: RewardPlatformEventSchema.parse({
					event: "reward.claim_expired",
					actorUserId: event.userId,
					organizationId: event.organizationId,
					metadata: { claimId: event.claimId, isReferrerCredit: event.isReferrerCredit },
				}),
			};
		}
		return null;
	}
}
