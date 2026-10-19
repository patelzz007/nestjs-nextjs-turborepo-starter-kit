import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PublicUrlResolver } from "../../../../config/public-url.resolver";
import type { ScopeFactory } from "../../../../platform/application/events/in-transaction-event-handler";
import type { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import { createFilesTransactionalPorts } from "../../../files/public-api";
import { ORGANIZATION_READ, type OrganizationReadPort } from "../../../organizations/public-api";
import { OrganizationDisplayAdapter } from "../adapters/organization-display.adapter";
import type { RewardsScope } from "../../application/rewards-scope";
import { PrismaLegalAcceptanceRepository } from "./prisma-legal-acceptance.repository";
import { PrismaOrganizationStoresAdapter, PrismaRewardAuditWriter, RewardImageFilesAdapter, PrismaRewardViewAdapter } from "./prisma-reward-transactional.adapters";
import { PrismaRewardRepository } from "./prisma-reward.repository";

/** Builds the rewards scope bound to the unit-of-work transaction. New instances every call; never cached. */
@Injectable()
export class RewardsScopeFactory implements ScopeFactory<RewardsScope, Prisma.TransactionClient> {
	public constructor(
		private readonly publicUrls: PublicUrlResolver,
		@Inject(ORGANIZATION_READ) private readonly organizations: OrganizationReadPort,
	) {}

	public create(db: Prisma.TransactionClient, events: TransactionalEventCollector): RewardsScope {
		return {
			rewards: this.rewardRepository(db),
			legalAcceptances: new PrismaLegalAcceptanceRepository(db),
			imageFiles: new RewardImageFilesAdapter(createFilesTransactionalPorts(db).fileReferences),
			stores: new PrismaOrganizationStoresAdapter(db),
			views: new PrismaRewardViewAdapter(db, new OrganizationDisplayAdapter(this.organizations), this.publicUrls.resolve),
			audit: new PrismaRewardAuditWriter(db),
			events,
		};
	}

	/** The reward repository for one transaction (a test-only factory may substitute a failing one). */
	protected rewardRepository(db: Prisma.TransactionClient): PrismaRewardRepository {
		return new PrismaRewardRepository(db);
	}
}
