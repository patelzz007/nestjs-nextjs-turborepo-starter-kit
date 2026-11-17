import { Module } from "@nestjs/common";

import { FeatureFlagsModule } from "../../feature-flags.module";
import { FeatureFlagsMaintenanceProcessor } from "../../presentation/jobs/feature-flags-maintenance.processor";
import { FeatureFlagsMaintenanceScheduler } from "./feature-flags-maintenance.scheduler";

/**
 * The feature flags maintenance worker and its schedule (expire pending revisions, announce scheduled rollout steps);
 * imported by the app only when Redis is configured. Without it, clients still refetch at a bundle's `nextChangeAt`.
 */
@Module({
	imports: [FeatureFlagsModule],
	providers: [FeatureFlagsMaintenanceScheduler, FeatureFlagsMaintenanceProcessor],
})
export class FeatureFlagsQueueModule {}
