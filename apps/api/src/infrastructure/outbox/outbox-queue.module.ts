import { Module } from "@nestjs/common";

import { OutboxModule } from "./outbox.module";
import { OutboxPublishProcessor, OutboxQueueScheduler } from "./outbox-queue.processors";

/** BullMQ workers for the transactional outbox (requires Redis). */
@Module({
	imports: [OutboxModule],
	providers: [OutboxQueueScheduler, OutboxPublishProcessor],
})
export class OutboxQueueModule {}
