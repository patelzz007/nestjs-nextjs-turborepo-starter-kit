import { Global, Module } from "@nestjs/common";

import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import { CLOCK, type Clock } from "../../../application/clock.port";
import { APP_CACHE, type AppCache } from "../../../application/ports/app-cache.port";
import { TENANT_RATE_LIMIT_OVERRIDES, type TenantRateLimitOverridesPort } from "../../../application/ports/tenant-rate-limit-overrides.port";
import { CachedTenantRateLimitOverrides } from "./cached-tenant-rate-limit-overrides";
import { PrismaTenantRateLimitOverrides } from "./prisma-tenant-rate-limit-overrides";

/**
 * Tenant rate-limit overrides (ADR 071), stored in the database and cached (ADR 072). Separate from
 * `RateLimitingModule`, which needs only Redis: the limiter itself never depends on tenant data.
 */
@Global()
@Module({
	providers: [
		{
			provide: TENANT_RATE_LIMIT_OVERRIDES,
			inject: [TenantTransactionService, CLOCK, APP_CACHE],
			useFactory: (transactions: TenantTransactionService, clock: Clock, cache: AppCache): TenantRateLimitOverridesPort =>
				new CachedTenantRateLimitOverrides(new PrismaTenantRateLimitOverrides(transactions, clock), clock, cache),
		},
	],
	exports: [TENANT_RATE_LIMIT_OVERRIDES],
})
export class TenantRateLimitOverridesModule {}
