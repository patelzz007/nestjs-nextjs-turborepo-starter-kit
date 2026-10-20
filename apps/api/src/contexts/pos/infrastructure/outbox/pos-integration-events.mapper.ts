import { RewardPlatformEventSchema, type PlatformEventInput } from "@workspace/shared";

import type { IntegrationEventMapper } from "../../../../platform/application/events/integration-event-mapper";
import type { DomainEvent } from "../../../../platform/domain/domain-event";
import { SaleCheckedOut } from "../../domain/events/pos.events";

/**
 * Pos's outbox records (mechanism 3): every paid bill feeds the `reward.platform` analytics stream
 * exactly once as `merchant.redeem_reward`, byte-compatible with what the legacy checkout wrote.
 */
export class PosIntegrationEventsMapper implements IntegrationEventMapper {
	public map(event: DomainEvent): PlatformEventInput | null {
		if (event instanceof SaleCheckedOut) {
			return {
				type: "reward.platform",
				payload: RewardPlatformEventSchema.parse({
					event: "merchant.redeem_reward",
					actorUserId: null,
					tenantId: event.tenantId,
					metadata: {
						saleId: event.saleId,
						customerUserId: event.customerUserId,
						locationId: event.locationId,
						terminalId: event.terminalId,
						billTotalMinor: event.billTotalMinor,
						currency: event.currency,
						claimIds: [...event.claimIds],
					},
				}),
			};
		}
		return null;
	}
}
