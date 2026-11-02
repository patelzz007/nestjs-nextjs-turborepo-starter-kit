import { Logger } from "@nestjs/common";

import type { NotificationQueues } from "../../application/ports/notification-queues.port";
import type { ChannelDelivery } from "../../application/services/channel-delivery";
import type { NotificationDispatcher } from "../../application/services/notification-dispatcher";

/**
 * Without Redis (a single local process): the work runs in this process right after the caller's
 * commit. A failure is logged; the minute maintenance run picks the row up again (the notification is
 * its own outbox, a QUEUED delivery is re-queued), so nothing is lost.
 */
export class InlineNotificationQueues implements NotificationQueues {
	private readonly logger: Logger = new Logger("InlineNotificationQueues");
	private dispatcher: Pick<NotificationDispatcher, "fanOut"> | null = null;
	private delivery: Pick<ChannelDelivery, "deliver"> | null = null;

	/** Wired after construction: the dispatcher itself depends on these queues. */
	public bind(dispatcher: Pick<NotificationDispatcher, "fanOut">, delivery: Pick<ChannelDelivery, "deliver">): void {
		this.dispatcher = dispatcher;
		this.delivery = delivery;
	}

	public fanOut(notificationId: string): Promise<void> {
		const dispatcher = this.dispatcher;
		setImmediate((): void => {
			dispatcher?.fanOut(notificationId).catch((error: unknown): void => {
				this.logger.warn(`notifications.inline_fan_out_failed id=${notificationId}; the maintenance run retries it`, error);
			});
		});
		return Promise.resolve();
	}

	public deliver(channel: "PUSH" | "SMS", deliveryId: string): Promise<void> {
		const delivery = this.delivery;
		setImmediate((): void => {
			delivery?.deliver(channel, deliveryId).catch((error: unknown): void => {
				this.logger.warn(`notifications.inline_delivery_failed id=${deliveryId}; the maintenance run retries it`, error);
			});
		});
		return Promise.resolve();
	}
}
