import { Inject, Logger } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { NotificationRequested } from "../../../domain/events/notification-requested.event";
import { NOTIFICATION_QUEUES, type NotificationQueues } from "../../ports/notification-queues.port";

/**
 * After commit (best effort): hands a just-committed notification to the fan-out at once. A failure is
 * logged, never rethrown: the row is still un-fanned and the minute maintenance run picks it up (ADR 070).
 */
@EventsHandler(NotificationRequested)
export class FanOutOnNotificationRequested implements IEventHandler<NotificationRequested> {
	private readonly logger: Logger = new Logger(FanOutOnNotificationRequested.name);

	public constructor(@Inject(NOTIFICATION_QUEUES) private readonly queues: NotificationQueues) {}

	public async handle(event: NotificationRequested): Promise<void> {
		try {
			await this.queues.fanOut(event.notificationId);
		} catch (error) {
			this.logger.warn(`Immediate fan-out hand-off of ${event.notificationId} failed; the maintenance run will pick it up`, error);
		}
	}
}
