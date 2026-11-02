import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { systemActor } from "../../../../platform/application/actor-context";
import { SystemCommandDispatcher } from "../../../../platform/application/system-command-dispatcher";
import { RunNotificationsMaintenanceCommand } from "../../application/commands/run-notifications-maintenance/run-notifications-maintenance.command";
import { NOTIFICATIONS_MAINTENANCE_OPERATION } from "../../application/services/notifications-maintenance";

/**
 * Notifications housekeeping (ADR 070), as audited system commands: every minute the sweep, held
 * releases and digests; daily at 03:00 the retention and ended-session device revocation. Safe on every
 * replica at once (every claim and transition is conditional).
 */
@Injectable()
export class NotificationsMaintenanceCron {
	private readonly logger: Logger = new Logger(NotificationsMaintenanceCron.name);

	public constructor(@Inject(SystemCommandDispatcher) private readonly dispatcher: Pick<SystemCommandDispatcher, "dispatch">) {}

	@Cron(CronExpression.EVERY_MINUTE)
	public async everyMinute(): Promise<void> {
		const summary = await this.dispatcher.dispatch(
			new RunNotificationsMaintenanceCommand(systemActor(NOTIFICATIONS_MAINTENANCE_OPERATION, "cron", null, "Notifications: sweep, release held deliveries, digests", null), {
				run: "minute",
			}),
			{ kind: "cron", name: "NotificationsMaintenanceCron.everyMinute" },
		);
		this.logger.debug({ event: NOTIFICATIONS_MAINTENANCE_OPERATION, summary });
	}

	@Cron(CronExpression.EVERY_DAY_AT_3AM)
	public async daily(): Promise<void> {
		const summary = await this.dispatcher.dispatch(
			new RunNotificationsMaintenanceCommand(systemActor(NOTIFICATIONS_MAINTENANCE_OPERATION, "cron", null, "Notifications: retention and ended-session devices", null), {
				run: "daily",
			}),
			{ kind: "cron", name: "NotificationsMaintenanceCron.daily" },
		);
		this.logger.log({ event: "notifications.retention", summary });
	}
}
