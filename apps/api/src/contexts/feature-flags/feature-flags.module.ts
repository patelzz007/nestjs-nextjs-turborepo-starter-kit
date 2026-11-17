import { Module, type OnModuleInit } from "@nestjs/common";
import type Redis from "ioredis";

import { TypedConfigService } from "../../config/typed-config.service";
import { CLOCK, type Clock } from "../../platform/application/clock.port";
import { PersonalDataErasureRegistry } from "../../platform/application/personal-data/personal-data-erasure.registry";
import { PersonalDataExportRegistry } from "../../platform/application/personal-data/personal-data-export.registry";
import { APP_CACHE, type AppCache } from "../../platform/application/ports/app-cache.port";
import { OutboxModule } from "../../platform/infrastructure/outbox/outbox.module";
import { PlatformOutboxService } from "../../platform/infrastructure/outbox/platform-outbox.service";
import { REDIS_PUBLISHER, REDIS_SUBSCRIBER } from "../../platform/infrastructure/redis/redis.tokens";
import { PrismaModule } from "../../prisma/prisma.module";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { EXPERIMENT_STORE, type ExperimentStore } from "./application/ports/experiment.store";
import { EXPOSURE_RECORDER, type ExposureRecorder } from "./application/ports/exposure-recorder.port";
import { FEATURE_FLAGS } from "./application/ports/feature-flags.port";
import { FLAG_ADMIN_STORE, type FlagAdminStore } from "./application/ports/flag-admin.store";
import {
	CATALOG_VERSION_SIGNAL,
	FLAG_CATALOG_LOADER,
	FLAG_CATALOG_SOURCE,
	type CatalogVersionSignal,
	type FlagCatalogLoader,
	type FlagCatalogSource,
} from "./application/ports/flag-catalog.port";
import { FLAG_GROUP_STORE, type FlagGroupStore } from "./application/ports/flag-group.store";
import { FLAG_MAINTENANCE_STORE, type FlagMaintenanceStore } from "./application/ports/flag-maintenance.store";
import { SERVER_EXPOSURES, type ServerExposures } from "./application/ports/server-exposures.port";
import { ConfigAdminService } from "./application/services/config-admin.service";
import { ExperimentService } from "./application/services/experiment.service";
import { ExposureIntakeService } from "./application/services/exposure-intake.service";
import { FlagAdminService } from "./application/services/flag-admin.service";
import { FlagEvaluationService } from "./application/services/flag-evaluation.service";
import { FlagGroupService } from "./application/services/flag-group.service";
import { FlagMaintenanceService } from "./application/services/flag-maintenance.service";
import { PromotionService } from "./application/services/promotion.service";
import { RevisionWorkflow } from "./application/services/revision-workflow";
import { SubjectFactsRegistry } from "./application/services/subject-facts.registry";
import {
	CONFIG_ADMIN,
	EXPERIMENTS,
	EXPOSURE_INTAKE,
	FLAG_ADMIN,
	FLAG_EVALUATION,
	FLAG_GROUPS,
	FLAG_MAINTENANCE,
	PROMOTIONS,
	REVISION_WORKFLOW,
	SUBJECT_FACTS,
} from "./feature-flags.tokens";
import { CachedFlagCatalogSource } from "./infrastructure/cache/cached-flag-catalog.source";
import { BufferedServerExposures } from "./infrastructure/exposures/buffered-server-exposures";
import { OutboxExposureRecorder } from "./infrastructure/exposures/outbox-exposure.recorder";
import { PrismaExperimentStore } from "./infrastructure/persistence/prisma-experiment.store";
import { PrismaFlagAdminStore } from "./infrastructure/persistence/prisma-flag-admin.store";
import { PrismaFlagCatalogLoader } from "./infrastructure/persistence/prisma-flag-catalog.loader";
import { PrismaFlagGroupStore } from "./infrastructure/persistence/prisma-flag-group.store";
import { PrismaFlagMaintenanceStore } from "./infrastructure/persistence/prisma-flag-maintenance.store";
import { FeatureFlagsPersonalDataExporter, featureFlagsEraser } from "./infrastructure/personal-data/feature-flags-personal-data";
import { RedisCatalogVersionSignal } from "./infrastructure/signals/redis-catalog-version.signal";
import { DynamicConfigsController } from "./presentation/http/dynamic-configs.controller";
import { ExperimentsController } from "./presentation/http/experiments.controller";
import { FeatureFlagsClientController } from "./presentation/http/feature-flags-client.controller";
import { FeatureFlagsController } from "./presentation/http/feature-flags.controller";
import { FlagGroupsController } from "./presentation/http/flag-groups.controller";
import { FlagPromotionController } from "./presentation/http/flag-promotion.controller";
import { FeatureFlagGuard } from "./presentation/http/require-feature-flag";

/**
 * Feature flags v2 (ADR 086, ADR 087): the catalogue and its engine, every app's bundle and live stream, exposures,
 * and the console's flags, configs, groups, experiments and rule promotion. Imports no other context: the facts
 * rules read about a person come from the contexts that own them, registered on `SUBJECT_FACTS` at start-up.
 * Exports the server-side check (`FEATURE_FLAGS`, `@RequireFeatureFlag`'s guard) and that registry (public-api).
 */
@Module({
	imports: [PrismaModule, OutboxModule],
	controllers: [FeatureFlagsClientController, FeatureFlagsController, FlagPromotionController, DynamicConfigsController, FlagGroupsController, ExperimentsController],
	providers: [
		{ provide: SUBJECT_FACTS, useValue: new SubjectFactsRegistry() },
		{
			provide: FLAG_CATALOG_LOADER,
			inject: [TenantTransactionService],
			useFactory: (transactions: TenantTransactionService): FlagCatalogLoader => new PrismaFlagCatalogLoader(transactions),
		},
		{
			provide: CATALOG_VERSION_SIGNAL,
			inject: [TypedConfigService, REDIS_PUBLISHER, REDIS_SUBSCRIBER],
			useFactory: (config: TypedConfigService, publisher: Redis | null, subscriber: Redis | null): RedisCatalogVersionSignal =>
				new RedisCatalogVersionSignal(config, publisher, subscriber),
		},
		{
			provide: FLAG_CATALOG_SOURCE,
			inject: [APP_CACHE, FLAG_CATALOG_LOADER, CATALOG_VERSION_SIGNAL],
			useFactory: (cache: AppCache, loader: FlagCatalogLoader, signal: CatalogVersionSignal): FlagCatalogSource => new CachedFlagCatalogSource(cache, loader, signal),
		},
		{
			provide: EXPOSURE_RECORDER,
			inject: [PlatformOutboxService],
			useFactory: (outbox: PlatformOutboxService): ExposureRecorder => new OutboxExposureRecorder(outbox),
		},
		{
			provide: SERVER_EXPOSURES,
			inject: [EXPOSURE_RECORDER, CLOCK],
			useFactory: (recorder: ExposureRecorder, clock: Clock): BufferedServerExposures => new BufferedServerExposures(recorder, () => clock.now()),
		},
		{
			provide: FLAG_EVALUATION,
			inject: [FLAG_CATALOG_SOURCE, SUBJECT_FACTS, SERVER_EXPOSURES, CLOCK, TypedConfigService],
			useFactory: (catalog: FlagCatalogSource, facts: SubjectFactsRegistry, exposures: ServerExposures, clock: Clock, config: TypedConfigService): FlagEvaluationService =>
				new FlagEvaluationService(catalog, facts, exposures, clock, config.runtime.deploymentEnvironment),
		},
		{ provide: FEATURE_FLAGS, useExisting: FLAG_EVALUATION },
		{
			provide: EXPOSURE_INTAKE,
			inject: [EXPOSURE_RECORDER, SUBJECT_FACTS],
			useFactory: (recorder: ExposureRecorder, facts: SubjectFactsRegistry): ExposureIntakeService => new ExposureIntakeService(recorder, facts),
		},
		{
			provide: FLAG_ADMIN_STORE,
			inject: [TenantTransactionService],
			useFactory: (transactions: TenantTransactionService): FlagAdminStore => new PrismaFlagAdminStore(transactions),
		},
		{
			provide: FLAG_GROUP_STORE,
			inject: [TenantTransactionService],
			useFactory: (transactions: TenantTransactionService): FlagGroupStore => new PrismaFlagGroupStore(transactions),
		},
		{
			provide: EXPERIMENT_STORE,
			inject: [TenantTransactionService],
			useFactory: (transactions: TenantTransactionService): ExperimentStore => new PrismaExperimentStore(transactions),
		},
		{
			provide: FLAG_MAINTENANCE_STORE,
			inject: [TenantTransactionService],
			useFactory: (transactions: TenantTransactionService): FlagMaintenanceStore => new PrismaFlagMaintenanceStore(transactions),
		},
		{
			provide: REVISION_WORKFLOW,
			inject: [FLAG_ADMIN_STORE, FLAG_CATALOG_SOURCE, CLOCK, TypedConfigService],
			useFactory: (store: FlagAdminStore, catalog: FlagCatalogSource, clock: Clock, config: TypedConfigService): RevisionWorkflow =>
				new RevisionWorkflow(store, catalog, clock, config.runtime.deploymentEnvironment),
		},
		{
			provide: FLAG_ADMIN,
			inject: [FLAG_ADMIN_STORE, REVISION_WORKFLOW, FLAG_CATALOG_SOURCE, CLOCK, TypedConfigService],
			useFactory: (store: FlagAdminStore, workflow: RevisionWorkflow, catalog: FlagCatalogSource, clock: Clock, config: TypedConfigService): FlagAdminService =>
				new FlagAdminService(store, workflow, catalog, clock, config.runtime.deploymentEnvironment),
		},
		{
			provide: CONFIG_ADMIN,
			inject: [FLAG_ADMIN_STORE, EXPERIMENT_STORE, REVISION_WORKFLOW, CLOCK],
			useFactory: (store: FlagAdminStore, experiments: ExperimentStore, workflow: RevisionWorkflow, clock: Clock): ConfigAdminService =>
				new ConfigAdminService(store, experiments, workflow, clock),
		},
		{
			provide: FLAG_GROUPS,
			inject: [FLAG_GROUP_STORE, FLAG_CATALOG_SOURCE, CLOCK],
			useFactory: (store: FlagGroupStore, catalog: FlagCatalogSource, clock: Clock): FlagGroupService => new FlagGroupService(store, catalog, clock),
		},
		{
			provide: EXPERIMENTS,
			inject: [EXPERIMENT_STORE, FLAG_ADMIN_STORE, FLAG_CATALOG_SOURCE, CLOCK],
			useFactory: (store: ExperimentStore, flags: FlagAdminStore, catalog: FlagCatalogSource, clock: Clock): ExperimentService =>
				new ExperimentService(store, flags, catalog, clock),
		},
		{
			provide: PROMOTIONS,
			inject: [FLAG_ADMIN_STORE, FLAG_GROUP_STORE, REVISION_WORKFLOW, FLAG_CATALOG_SOURCE, CLOCK, TypedConfigService],
			useFactory: (
				flags: FlagAdminStore,
				groups: FlagGroupStore,
				workflow: RevisionWorkflow,
				catalog: FlagCatalogSource,
				clock: Clock,
				config: TypedConfigService,
			): PromotionService => new PromotionService(flags, groups, workflow, catalog, clock, config.runtime.deploymentEnvironment),
		},
		{
			provide: FLAG_MAINTENANCE,
			inject: [FLAG_MAINTENANCE_STORE, FLAG_CATALOG_SOURCE, CLOCK],
			useFactory: (store: FlagMaintenanceStore, catalog: FlagCatalogSource, clock: Clock): FlagMaintenanceService => new FlagMaintenanceService(store, catalog, clock),
		},
		FeatureFlagGuard,
	],
	// FLAG_MAINTENANCE is for the maintenance worker (FeatureFlagsQueueModule), not for other contexts.
	exports: [FEATURE_FLAGS, SUBJECT_FACTS, FeatureFlagGuard, FLAG_MAINTENANCE],
})
export class FeatureFlagsModule implements OnModuleInit {
	public constructor(
		private readonly personalData: PersonalDataExportRegistry,
		private readonly erasure: PersonalDataErasureRegistry,
		private readonly transactions: TenantTransactionService,
	) {}

	/** Registers this context's section of "Download my data" and its part of account erasure (ADR 077). */
	public onModuleInit(): void {
		this.personalData.register(new FeatureFlagsPersonalDataExporter(this.transactions));
		this.erasure.registerEraser(featureFlagsEraser(this.transactions));
	}
}
