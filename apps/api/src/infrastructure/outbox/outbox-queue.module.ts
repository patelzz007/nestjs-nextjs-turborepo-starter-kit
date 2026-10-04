import { Module } from "@nestjs/common";

import { OutboxModule } from "./outbox.module";
import { OutboxPublishProcessor, OutboxQueueScheduler } from "./outbox-queue.processors";
import { OutboxRetentionProcessor, OutboxRetentionScheduler } from "./outbox-retention.processor";
import { OutboxRetentionRepository } from "./outbox-retention.repository";
import { OutboxRetentionService } from "./outbox-retention.service";

/**
 * BullMQ workers for the transactional outbox (requires Redis): the publish
 * sweep and the hourly retention job that deletes settled rows.
 */
@Module({
	imports: [OutboxModule],
	providers: [OutboxQueueScheduler, OutboxPublishProcessor, OutboxRetentionRepository, OutboxRetentionService, OutboxRetentionScheduler, OutboxRetentionProcessor],
})
export class OutboxQueueModule {}
