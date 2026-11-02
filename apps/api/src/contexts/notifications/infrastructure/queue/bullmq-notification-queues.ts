import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { QUEUE_JOB_OPTIONS, QUEUE_NAMES } from "@workspace/shared";
import { Queue } from "bullmq";

import {
	NotificationChannelJobSchema,
	NotificationFanOutJobSchema,
	type NotificationChannelJob,
	type NotificationFanOutJob,
	type NotificationQueues,
} from "../../application/ports/notification-queues.port";

/** The notification queues on BullMQ (ADR 070): jobId = the row id, so handing the same row off twice is deduplicated. */
@Injectable()
export class BullMqNotificationQueues implements NotificationQueues {
	public constructor(
		@InjectQueue(QUEUE_NAMES.notificationsFanOut) private readonly fanOutQueue: Queue<NotificationFanOutJob>,
		@InjectQueue(QUEUE_NAMES.notificationsPush) private readonly pushQueue: Queue<NotificationChannelJob>,
		@InjectQueue(QUEUE_NAMES.notificationsSms) private readonly smsQueue: Queue<NotificationChannelJob>,
	) {}

	public async fanOut(notificationId: string): Promise<void> {
		await this.fanOutQueue.add("fan-out", NotificationFanOutJobSchema.parse({ notificationId }), { ...QUEUE_JOB_OPTIONS.notificationsFanOut, jobId: notificationId });
	}

	public async deliver(channel: "PUSH" | "SMS", deliveryId: string): Promise<void> {
		const queue = channel === "PUSH" ? this.pushQueue : this.smsQueue;
		await queue.add("deliver", NotificationChannelJobSchema.parse({ deliveryId }), { ...QUEUE_JOB_OPTIONS.notificationsChannel, jobId: deliveryId });
	}
}
