import { Module } from "@nestjs/common";

import { SystemCommandModule } from "../../../../platform/infrastructure/system-command.module";
import { EmailSendProcessor } from "../../presentation/jobs/email-send.processor";
import { EmailQueueService } from "../adapters/email-queue.adapter";

/**
 * BullMQ wiring of the `emailSend` queue — imported by `NotificationsModule`
 * only when Redis is configured: the queue producer the outbox hand-off uses,
 * and the worker that dispatches `DeliverEmail`. A separate module because
 * both inject BullMQ queues that exist only with Redis.
 */
@Module({
	imports: [SystemCommandModule],
	providers: [EmailQueueService, EmailSendProcessor],
	exports: [EmailQueueService],
})
export class NotificationsQueueModule {}
