import { Module } from "@nestjs/common";

import { SystemCommandModule } from "../../../../platform/infrastructure/system-command.module";
import { EmailSendProcessor } from "../../presentation/jobs/email-send.processor";
import { EmailQueueService } from "../adapters/email-queue.adapter";
import { NotificationFanOutProcessor, NotificationPushProcessor, NotificationSmsProcessor } from "../../presentation/jobs/notification-queue.processors";
import { BullMqNotificationQueues } from "./bullmq-notification-queues";
import { BullMqBroadcastQueue } from "./broadcast-queues";
import { BroadcastSendProcessor } from "../../presentation/jobs/broadcast.jobs";

/** The BullMQ notification queues (ADR 070), provided only with Redis. */
export const BULLMQ_NOTIFICATION_QUEUES = BullMqNotificationQueues;

/**
 * BullMQ wiring of the `emailSend` queue — imported by `NotificationsModule`
 * only when Redis is configured: the queue producer the outbox hand-off uses,
 * and the worker that dispatches `DeliverEmail`. A separate module because
 * both inject BullMQ queues that exist only with Redis.
 */
@Module({
	imports: [SystemCommandModule],
	providers: [
		EmailQueueService,
		EmailSendProcessor,
		BullMqNotificationQueues,
		NotificationFanOutProcessor,
		NotificationPushProcessor,
		NotificationSmsProcessor,
		BullMqBroadcastQueue,
		BroadcastSendProcessor,
	],
	exports: [EmailQueueService, BullMqNotificationQueues, BullMqBroadcastQueue],
})
export class NotificationsQueueModule {}
