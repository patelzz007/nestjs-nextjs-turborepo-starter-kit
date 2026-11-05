import { Module } from "@nestjs/common";

import { CLOCK, type Clock } from "../../platform/application/clock.port";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { FEATURE_FLAG_STORE, FEATURE_FLAGS_SERVICE, type FeatureFlagStore } from "./application/ports/feature-flag.store";
import { FeatureFlagsService } from "./application/services/feature-flags.service";
import { STORE_FEATURE_FLAGS, type StoreFeatureFlags } from "./application/ports/store-feature-flags.port";
import { PrismaFeatureFlagStore } from "./infrastructure/persistence/prisma-feature-flag.store";
import { PrismaStoreFeatureFlags } from "./infrastructure/persistence/prisma-store-feature-flags";
import { FeatureFlagsController } from "./presentation/http/feature-flags.controller";

/** Runtime feature flags (enhancements 5.6, 5.11). Imports no other context; exports the store-flag reader (public-api). */
@Module({
	controllers: [FeatureFlagsController],
	providers: [
		{
			provide: FEATURE_FLAG_STORE,
			inject: [TenantTransactionService],
			useFactory: (transactions: TenantTransactionService): FeatureFlagStore => new PrismaFeatureFlagStore(transactions),
		},
		{
			provide: FEATURE_FLAGS_SERVICE,
			inject: [FEATURE_FLAG_STORE, CLOCK],
			useFactory: (store: FeatureFlagStore, clock: Clock): FeatureFlagsService => new FeatureFlagsService(store, clock),
		},
		{
			provide: STORE_FEATURE_FLAGS,
			inject: [TenantTransactionService],
			useFactory: (transactions: TenantTransactionService): StoreFeatureFlags => new PrismaStoreFeatureFlags(transactions),
		},
	],
	exports: [STORE_FEATURE_FLAGS],
})
export class FeatureFlagsModule {}
