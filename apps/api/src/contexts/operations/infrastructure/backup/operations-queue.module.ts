import { Module } from "@nestjs/common";

import { OpsBackupProcessor } from "./backup.processor";

/**
 * BullMQ wiring of the backup queue — imported by `OperationsModule` only when Redis is configured
 * (it registers a worker on a queue that exists only with Redis), like `FilesQueueModule`.
 */
@Module({
	providers: [OpsBackupProcessor],
})
export class OperationsQueueModule {}
