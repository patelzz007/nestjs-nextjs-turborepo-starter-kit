import { Module } from "@nestjs/common";

import { SystemCommandModule } from "../../../../platform/infrastructure/system-command.module";
import { StorageCdnInvalidationProcessor, StorageCleanupProcessor, StorageDeleteProcessor, StorageScanProcessor } from "../../presentation/jobs/storage-queue.processors";
import { StorageCleanupScheduler } from "../adapters/storage-cleanup.scheduler";

/**
 * BullMQ wiring of the storage queues — imported by `FilesModule` only when
 * Redis is configured: the hourly cleanup scheduler and the four workers, each
 * of which dispatches its command through the SystemCommandDispatcher. A
 * separate module because they inject BullMQ queues that exist only with Redis.
 */
@Module({
	imports: [SystemCommandModule],
	providers: [StorageCleanupScheduler, StorageCleanupProcessor, StorageDeleteProcessor, StorageScanProcessor, StorageCdnInvalidationProcessor],
})
export class FilesQueueModule {}
