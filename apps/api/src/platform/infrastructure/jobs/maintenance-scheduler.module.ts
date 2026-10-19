import { Global, Module } from "@nestjs/common";

import { MaintenanceSchedulerRegistry } from "./maintenance-scheduler.registry";

/** The one {@link MaintenanceSchedulerRegistry} every module's scheduler adds to (global: any queue module may inject it). */
@Global()
@Module({
	providers: [MaintenanceSchedulerRegistry],
	exports: [MaintenanceSchedulerRegistry],
})
export class MaintenanceSchedulerModule {}
