import { Global, Module } from "@nestjs/common";

import { CUSTOMER_TIER_ACCESS, type CustomerTierAccessPort } from "../../../platform/application/ports/customer-tier-access.port";
import { PrismaModule } from "../../../prisma/prisma.module";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { API_FEATURE_FLAGS, FeatureFlagsModule, type ApiFeatureFlags } from "../../feature-flags/public-api";
import { CUSTOMER_TIER_SNAPSHOT_FACTORY } from "../../pos/public-api";
import { TierAccessService } from "../application/services/tier-access.service";
import { PRISMA_TIER_SNAPSHOT_FACTORY } from "./adapters/tier-snapshot.adapter";
import { TiersAvailabilityAdapter } from "./adapters/tiers-availability.adapter";
import { PrismaTierReadRepository } from "./persistence/prisma-tier.read-repository";

/**
 * What the tiers context provides to the contexts that must not import it (ADR 085): customers' tiers for rewards,
 * claims and a merchant's customer list (`CUSTOMER_TIER_ACCESS`), and the tier recorded on a redemption inside pos's
 * checkout (`CUSTOMER_TIER_SNAPSHOT_FACTORY`). Global, like pos's access module, so the consumers never import tiers
 * and the graph stays acyclic without `forwardRef` (tiers reacts to pos's `SaleCheckedOut`).
 */
@Global()
@Module({
	imports: [PrismaModule, FeatureFlagsModule],
	providers: [
		{
			provide: CUSTOMER_TIER_ACCESS,
			inject: [TenantTransactionService, API_FEATURE_FLAGS],
			useFactory: (transactions: TenantTransactionService, flags: ApiFeatureFlags): CustomerTierAccessPort =>
				new TierAccessService(new PrismaTierReadRepository(transactions), new TiersAvailabilityAdapter(flags)),
		},
		{ provide: CUSTOMER_TIER_SNAPSHOT_FACTORY, useValue: PRISMA_TIER_SNAPSHOT_FACTORY },
	],
	exports: [CUSTOMER_TIER_ACCESS, CUSTOMER_TIER_SNAPSHOT_FACTORY],
})
export class TiersAccessModule {}
