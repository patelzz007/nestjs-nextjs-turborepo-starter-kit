import {
	TIER_DEMOTED_NOTIFICATION,
	TIER_DEMOTION_WARNING_NOTIFICATION,
	TIER_PROMOTED_NOTIFICATION,
	type NotificationRecipient,
	type NotifyTransactionalPort,
} from "../../../notifications/public-api";
import type { TierNoticesPort } from "../../application/ports/tier-notices.port";
import { CustomerTierDemoted, CustomerTierDemotionWarned, CustomerTierPromoted, type TierDomainEvent } from "../../domain/events/tier.events";

/**
 * {@link TierNoticesPort} over notifications' `notify()` (ADR 070), on the evaluation's transaction. Each notice's
 * dedupe key names the change it is about, so an evaluation retried after a crash never tells the customer twice.
 */
export class TierNoticesAdapter implements TierNoticesPort {
	public constructor(private readonly notify: NotifyTransactionalPort) {}

	public async send(event: TierDomainEvent): Promise<void> {
		const recipient: NotificationRecipient = { kind: "user", userId: event.userId };
		if (event instanceof CustomerTierPromoted) {
			await this.notify.notify({
				type: TIER_PROMOTED_NOTIFICATION,
				recipient,
				payload: { fromTier: event.fromTier, toTier: event.toTier, holdUntil: event.holdUntil },
				dedupeKey: `tier-promoted:${event.userId}:${String(event.occurredAt)}`,
				tenantId: null,
			});
			return;
		}
		if (event instanceof CustomerTierDemotionWarned) {
			await this.notify.notify({
				type: TIER_DEMOTION_WARNING_NOTIFICATION,
				recipient,
				payload: { currentTier: event.currentTier, toTier: event.toTier, dueAt: event.dueAt, redemptionsToKeep: event.redemptionsToKeep },
				dedupeKey: `tier-warning:${event.userId}:${String(event.dueAt)}`,
				tenantId: null,
			});
			return;
		}
		if (event instanceof CustomerTierDemoted) {
			await this.notify.notify({
				type: TIER_DEMOTED_NOTIFICATION,
				recipient,
				payload: { fromTier: event.fromTier, toTier: event.toTier },
				dedupeKey: `tier-demoted:${event.userId}:${String(event.occurredAt)}`,
				tenantId: null,
			});
		}
	}
}
