import type { TransactionalEventCollector } from "../../../platform/application/events/transactional-event-collector";
import type { TenantCustomerLinksPort } from "../../tenancy/public-api";
import type { LegalAcceptanceRepository } from "../domain/repositories/legal-acceptance.repository";
import type { RewardRepository } from "../domain/repositories/reward.repository";
import type { TenantStoresPort, RewardAuditPort, RewardImageFilesPort, RewardViewPort } from "./ports/rewards-transactional.ports";

/** Everything one rewards transaction can touch. Every member is bound to that transaction. */
export interface RewardsScope {
	readonly rewards: RewardRepository;
	readonly legalAcceptances: LegalAcceptanceRepository;
	readonly imageFiles: RewardImageFilesPort;
	readonly stores: TenantStoresPort;
	/** The tenant's customers (tenancy-owned links): who a reward can be given to. */
	readonly customers: TenantCustomerLinksPort;
	readonly views: RewardViewPort;
	readonly audit: RewardAuditPort;
	readonly events: TransactionalEventCollector;
}
