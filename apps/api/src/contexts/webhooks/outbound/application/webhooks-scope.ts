import type { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import type { NotifyTransactionalPort } from "../../../notifications/public-api";
import type { RewardRedemptionFactsPort } from "../../../rewards/public-api";
import type { ReviewNoticeFactsPort } from "../../../tenancy/public-api";
import type { WebhookDeliveryRepository, WebhookEndpointRepository, WebhookEventStore } from "../domain/repositories/webhooks.repositories";

/** Everything one webhooks transaction can touch. Every member is bound to that transaction (plan §5.4). */
export interface WebhooksScope {
	readonly endpoints: WebhookEndpointRepository;
	readonly webhookEvents: WebhookEventStore;
	readonly deliveries: WebhookDeliveryRepository;
	/** Rewards' facts: the tenant of a claimed reward (a claim names its reward, not its tenant). */
	readonly rewardFacts: RewardRedemptionFactsPort;
	/** Tenancy's slug and owners of a tenant, for the "endpoint turned off" notice. */
	readonly tenantOwners: ReviewNoticeFactsPort;
	readonly notify: NotifyTransactionalPort;
	readonly events: TransactionalEventCollector;
}
