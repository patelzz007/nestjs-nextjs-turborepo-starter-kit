import type { Prisma } from "@prisma/client";
import type { EpochMs, TierRules } from "@workspace/shared";

import type { ScopeFactory } from "../../../../platform/application/events/in-transaction-event-handler";
import type { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import type { NotificationsTransactionalPortsFactory } from "../../../notifications/public-api";
import type { TiersScope } from "../../application/tiers-scope";
import type { CountedRedemption } from "../../domain/policies/tier-window.policy";
import { TierNoticesAdapter } from "../adapters/tier-notices.adapter";
import { countedRedemptionsSince } from "./counted-redemptions.query";
import { PrismaTierStandingRepository } from "./prisma-tier-standing.repository";
import { readTierRules } from "./tier-settings.mapper";

/** Builds the tiers scope on one transaction: the standing, the counted redemptions, the rules and `notify()` (plan §5.4). */
export class TiersScopeFactory implements ScopeFactory<TiersScope, Prisma.TransactionClient> {
	public constructor(private readonly notifications: NotificationsTransactionalPortsFactory) {}

	public create(db: Prisma.TransactionClient, events: TransactionalEventCollector): TiersScope {
		return {
			standings: new PrismaTierStandingRepository(db),
			redemptions: { countedSince: (userId: string, since: EpochMs): Promise<readonly CountedRedemption[]> => countedRedemptionsSince(db, userId, since) },
			rules: { current: (): Promise<TierRules> => readTierRules(db) },
			notices: new TierNoticesAdapter(this.notifications.create(db, events).notifications),
		};
	}
}
