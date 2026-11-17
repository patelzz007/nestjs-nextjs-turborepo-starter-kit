import { Module, type OnModuleInit } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { CLOCK, type Clock } from "../../platform/application/clock.port";
import { PersonalDataErasureRegistry } from "../../platform/application/personal-data/personal-data-erasure.registry";
import { PersonalDataExportRegistry } from "../../platform/application/personal-data/personal-data-export.registry";
import type { UnitOfWork } from "../../platform/application/unit-of-work.port";
import { SystemCommandModule } from "../../platform/infrastructure/system-command.module";
import type { AfterCommitPublisher } from "../../platform/infrastructure/unit-of-work/after-commit-publisher";
import { PrismaUnitOfWork } from "../../platform/infrastructure/unit-of-work/prisma-unit-of-work";
import { TransactionalEventDispatcher } from "../../platform/infrastructure/unit-of-work/transactional-event-dispatcher";
import { AFTER_COMMIT_PUBLISHER, UnitOfWorkModule } from "../../platform/infrastructure/unit-of-work/unit-of-work.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { API_FEATURE_FLAGS, FeatureFlagsModule, type ApiFeatureFlags } from "../feature-flags/public-api";
import { NotificationsModule, NotificationsTransactionalPortsFactory } from "../notifications/public-api";
import { EvaluateCustomerTierHandler } from "./application/commands/evaluate-customer-tier/evaluate-customer-tier.handler";
import { ReviewCustomerTiersHandler } from "./application/commands/review-customer-tiers/review-customer-tiers.handler";
import { EvaluateTierAfterSale } from "./application/event-handlers/after-commit/evaluate-tier-after-sale.event-handler";
import type { TierReadPort } from "./application/ports/tier-reads.port";
import type { TierReviewCandidatesPort } from "./application/ports/tier-review-candidates.port";
import type { TierSettingsStore } from "./application/ports/tier-settings.store";
import type { TiersAvailabilityPort } from "./application/ports/tiers-availability.port";
import {
	TIER_EVALUATOR,
	TIER_READ_SERVICE,
	TIER_READS,
	TIER_REVIEW_CANDIDATES,
	TIER_SETTINGS_SERVICE,
	TIER_SETTINGS_STORE,
	TIERS_AVAILABILITY,
	TIERS_UNIT_OF_WORK,
} from "./application/ports/tiers.tokens";
import { TierEvaluator } from "./application/services/tier-evaluator";
import { TierReadService } from "./application/services/tier-read.service";
import { TierSettingsService } from "./application/services/tier-settings.service";
import type { TiersScope } from "./application/tiers-scope";
import { TiersAvailabilityAdapter } from "./infrastructure/adapters/tiers-availability.adapter";
import { PrismaTierReadRepository } from "./infrastructure/persistence/prisma-tier.read-repository";
import { PrismaTierReviewCandidates } from "./infrastructure/persistence/prisma-tier-review-candidates";
import { PrismaTierSettingsStore } from "./infrastructure/persistence/prisma-tier-settings.store";
import { TiersPersonalDataExporter, tiersEraser } from "./infrastructure/personal-data/tiers-personal-data";
import { TiersScopeFactory } from "./infrastructure/persistence/tiers-scope.factory";
import { AdminTiersController, AdminUserTierController } from "./presentation/http/admin-tiers.controller";
import { TiersController } from "./presentation/http/tiers.controller";
import { TierReviewCron } from "./presentation/jobs/tier-review.cron";

/**
 * Customer tiers (ADR 085): each customer's platform-wide tier, its history and the platform's tier rules; the
 * evaluation just after a redemption (reacting to pos's `SaleCheckedOut`) and the nightly review; the customer's tier
 * page and the admin console's tier rules and figures. A composition module (it reacts to pos and notifies through
 * notifications), mounted by `app.module.ts` only; what other contexts read comes from `TiersAccessModule`.
 */
@Module({
	imports: [PrismaModule, UnitOfWorkModule, SystemCommandModule, NotificationsModule, FeatureFlagsModule],
	controllers: [TiersController, AdminTiersController, AdminUserTierController],
	providers: [
		{
			provide: TIERS_UNIT_OF_WORK,
			inject: [TenantTransactionService, NotificationsTransactionalPortsFactory, TransactionalEventDispatcher, AFTER_COMMIT_PUBLISHER],
			useFactory: (
				transactions: TenantTransactionService,
				notifications: NotificationsTransactionalPortsFactory,
				dispatcher: TransactionalEventDispatcher<Prisma.TransactionClient>,
				publisher: AfterCommitPublisher,
			): UnitOfWork<TiersScope> => new PrismaUnitOfWork(transactions, new TiersScopeFactory(notifications), dispatcher, publisher),
		},
		{
			provide: TIERS_AVAILABILITY,
			inject: [API_FEATURE_FLAGS],
			useFactory: (flags: ApiFeatureFlags): TiersAvailabilityPort => new TiersAvailabilityAdapter(flags),
		},
		{
			provide: TIER_READS,
			inject: [TenantTransactionService],
			useFactory: (transactions: TenantTransactionService): TierReadPort => new PrismaTierReadRepository(transactions),
		},
		{
			provide: TIER_SETTINGS_STORE,
			inject: [TenantTransactionService],
			useFactory: (transactions: TenantTransactionService): TierSettingsStore => new PrismaTierSettingsStore(transactions),
		},
		{
			provide: TIER_REVIEW_CANDIDATES,
			inject: [TenantTransactionService],
			useFactory: (transactions: TenantTransactionService): TierReviewCandidatesPort => new PrismaTierReviewCandidates(transactions),
		},
		{
			provide: TIER_EVALUATOR,
			inject: [TIERS_UNIT_OF_WORK, CLOCK],
			useFactory: (uow: UnitOfWork<TiersScope>, clock: Clock): TierEvaluator => new TierEvaluator(uow, clock),
		},
		{
			provide: TIER_READ_SERVICE,
			inject: [TIER_READS, TIER_SETTINGS_STORE, TIERS_AVAILABILITY, CLOCK],
			useFactory: (reads: TierReadPort, settings: TierSettingsStore, availability: TiersAvailabilityPort, clock: Clock): TierReadService =>
				new TierReadService(reads, settings, availability, clock),
		},
		{
			provide: TIER_SETTINGS_SERVICE,
			inject: [TIER_SETTINGS_STORE, CLOCK],
			useFactory: (store: TierSettingsStore, clock: Clock): TierSettingsService => new TierSettingsService(store, clock),
		},
		EvaluateCustomerTierHandler,
		ReviewCustomerTiersHandler,
		EvaluateTierAfterSale,
		TierReviewCron,
	],
})
export class TiersModule implements OnModuleInit {
	public constructor(
		private readonly personalData: PersonalDataExportRegistry,
		private readonly erasure: PersonalDataErasureRegistry,
		private readonly transactions: TenantTransactionService,
	) {}

	/** Registers this context's section of "Download my data" and its part of account erasure (ADR 077). */
	public onModuleInit(): void {
		this.personalData.register(new TiersPersonalDataExporter(this.transactions));
		this.erasure.registerEraser(tiersEraser(this.transactions));
	}
}
