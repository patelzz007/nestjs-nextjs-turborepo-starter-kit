import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { BROADCAST_SERVICE, NOTIFICATION_DISPATCHER, CHANNEL_DELIVERY, NOTIFICATIONS_MAINTENANCE } from "../ports/notifications.tokens";
import type { BroadcastService } from "../services/broadcast-service";
import type { ChannelDelivery } from "../services/channel-delivery";
import type { NotificationDispatcher } from "../services/notification-dispatcher";
import type { NotificationsMaintenance } from "../services/notifications-maintenance";
import { DeliverNotificationCommand } from "./deliver-notification/deliver-notification.command";
import { FanOutNotificationCommand } from "./fan-out-notification/fan-out-notification.command";
import { RunNotificationsMaintenanceCommand } from "./run-notifications-maintenance/run-notifications-maintenance.command";
import { SendBroadcastCommand } from "./send-broadcast/send-broadcast.command";
import { StartDueBroadcastsCommand } from "./start-due-broadcasts/start-due-broadcasts.command";

@CommandHandler(FanOutNotificationCommand)
export class FanOutNotificationHandler implements ICommandHandler<FanOutNotificationCommand, void> {
	public constructor(@Inject(NOTIFICATION_DISPATCHER) private readonly dispatcher: Pick<NotificationDispatcher, "fanOut">) {}

	public async execute(command: FanOutNotificationCommand): Promise<void> {
		await this.dispatcher.fanOut(command.input.notificationId);
	}
}

@CommandHandler(DeliverNotificationCommand)
export class DeliverNotificationHandler implements ICommandHandler<DeliverNotificationCommand, void> {
	public constructor(@Inject(CHANNEL_DELIVERY) private readonly delivery: Pick<ChannelDelivery, "deliver">) {}

	public async execute(command: DeliverNotificationCommand): Promise<void> {
		await this.delivery.deliver(command.input.channel, command.input.deliveryId);
	}
}

@CommandHandler(RunNotificationsMaintenanceCommand)
export class RunNotificationsMaintenanceHandler implements ICommandHandler<RunNotificationsMaintenanceCommand, string> {
	public constructor(@Inject(NOTIFICATIONS_MAINTENANCE) private readonly maintenance: Pick<NotificationsMaintenance, "run" | "retain">) {}

	public async execute(command: RunNotificationsMaintenanceCommand): Promise<string> {
		const summary = command.input.run === "minute" ? await this.maintenance.run(command.actor) : await this.maintenance.retain(command.actor);
		return JSON.stringify(summary);
	}
}

@CommandHandler(SendBroadcastCommand)
export class SendBroadcastHandler implements ICommandHandler<SendBroadcastCommand, void> {
	public constructor(@Inject(BROADCAST_SERVICE) private readonly broadcasts: Pick<BroadcastService, "send">) {}

	public async execute(command: SendBroadcastCommand): Promise<void> {
		await this.broadcasts.send(command.actor, command.input.broadcastId);
	}
}

@CommandHandler(StartDueBroadcastsCommand)
export class StartDueBroadcastsHandler implements ICommandHandler<StartDueBroadcastsCommand, number> {
	public constructor(@Inject(BROADCAST_SERVICE) private readonly broadcasts: Pick<BroadcastService, "startDue">) {}

	public execute(command: StartDueBroadcastsCommand): Promise<number> {
		return this.broadcasts.startDue(command.actor);
	}
}
