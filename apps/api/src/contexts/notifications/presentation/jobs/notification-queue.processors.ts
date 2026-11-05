import { Processor, WorkerHost } from "@nestjs/bullmq";
import { MONITORED_WORKER_OPTIONS } from "@workspace/messaging/nest";
import { Injectable } from "@nestjs/common";
import { QUEUE_NAMES } from "@workspace/shared";
import type { Job } from "bullmq";

import { systemActor } from "../../../../platform/application/actor-context";
import { SystemCommandDispatcher } from "../../../../platform/application/system-command-dispatcher";
import { DeliverNotificationCommand } from "../../application/commands/deliver-notification/deliver-notification.command";
import { FanOutNotificationCommand } from "../../application/commands/fan-out-notification/fan-out-notification.command";
import { NOTIFICATIONS_DELIVER_OPERATION } from "../../application/services/channel-delivery";
import { NOTIFICATIONS_FAN_OUT_OPERATION } from "../../application/services/notification-dispatcher";
import { NotificationChannelJobSchema, NotificationFanOutJobSchema } from "../../application/ports/notification-queues.port";

/** `notifications.fan-out` worker: one notification → its deliveries, as an audited system command. */
@Processor(QUEUE_NAMES.notificationsFanOut, MONITORED_WORKER_OPTIONS)
@Injectable()
export class NotificationFanOutProcessor extends WorkerHost {
	public constructor(private readonly commands: SystemCommandDispatcher) {
		super();
	}

	public async process(job: Pick<Job, "data">): Promise<void> {
		const { notificationId } = NotificationFanOutJobSchema.parse(job.data);
		await this.commands.dispatch(
			new FanOutNotificationCommand(systemActor(NOTIFICATIONS_FAN_OUT_OPERATION, "job", null, "Fan out one notification", null), { notificationId }),
			{ kind: "job", name: QUEUE_NAMES.notificationsFanOut },
		);
	}
}

/** `notifications.push` worker: one push delivery. A retryable provider failure throws, and BullMQ backs off. */
@Processor(QUEUE_NAMES.notificationsPush, MONITORED_WORKER_OPTIONS)
@Injectable()
export class NotificationPushProcessor extends WorkerHost {
	public constructor(private readonly commands: SystemCommandDispatcher) {
		super();
	}

	public async process(job: Pick<Job, "data">): Promise<void> {
		const { deliveryId } = NotificationChannelJobSchema.parse(job.data);
		await this.commands.dispatch(
			new DeliverNotificationCommand(systemActor(NOTIFICATIONS_DELIVER_OPERATION, "job", null, "Send one push", null), { channel: "PUSH", deliveryId }),
			{
				kind: "job",
				name: QUEUE_NAMES.notificationsPush,
			},
		);
	}
}

/** `notifications.sms` worker: one SMS delivery. */
@Processor(QUEUE_NAMES.notificationsSms, MONITORED_WORKER_OPTIONS)
@Injectable()
export class NotificationSmsProcessor extends WorkerHost {
	public constructor(private readonly commands: SystemCommandDispatcher) {
		super();
	}

	public async process(job: Pick<Job, "data">): Promise<void> {
		const { deliveryId } = NotificationChannelJobSchema.parse(job.data);
		await this.commands.dispatch(
			new DeliverNotificationCommand(systemActor(NOTIFICATIONS_DELIVER_OPERATION, "job", null, "Send one SMS", null), { channel: "SMS", deliveryId }),
			{
				kind: "job",
				name: QUEUE_NAMES.notificationsSms,
			},
		);
	}
}
