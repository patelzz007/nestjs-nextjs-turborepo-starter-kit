import { Module } from "@nestjs/common";

import { DisabledEmailQueueService, EmailQueueService } from "../adapters/email-queue.adapter";

/** Without Redis (local development only): no worker, and the hand-off delivers inline. */
@Module({
	providers: [DisabledEmailQueueService, { provide: EmailQueueService, useExisting: DisabledEmailQueueService }],
	exports: [EmailQueueService],
})
export class NotificationsQueueDisabledModule {}
