import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { systemActor } from "../../../../platform/application/actor-context";
import { SystemCommandDispatcher } from "../../../../platform/application/system-command-dispatcher";
import { PruneGithubWebhookDeliveriesCommand } from "../../application/commands/prune-github-webhook-deliveries/prune-github-webhook-deliveries.command";

/** The system operation the deliveries table is reached through (bypass-only, ADR 052). */
const GITHUB_WEBHOOK_DELIVERIES_OPERATION = "github.webhook.deliveries";

/** The cron's name on its audit row. */
const RETENTION_CRON_NAME = "GithubWebhookDeliveryRetentionCron.prune";

/**
 * Prunes recorded GitHub webhook deliveries past their retention, hourly — a
 * system command, audited by the dispatcher. Each run is one bounded DELETE,
 * safe on every instance at once.
 */
@Injectable()
export class GithubWebhookDeliveryRetentionCron {
	private readonly logger: Logger = new Logger(GithubWebhookDeliveryRetentionCron.name);

	public constructor(@Inject(SystemCommandDispatcher) private readonly dispatcher: Pick<SystemCommandDispatcher, "dispatch">) {}

	@Cron(CronExpression.EVERY_HOUR)
	public async prune(): Promise<void> {
		const actor = systemActor(GITHUB_WEBHOOK_DELIVERIES_OPERATION, "cron", null, "Prune GitHub webhook deliveries past their retention", null);
		const pruned = await this.dispatcher.dispatch(new PruneGithubWebhookDeliveriesCommand(actor), { kind: "cron", name: RETENTION_CRON_NAME });
		if (pruned > 0) {
			this.logger.log(`Pruned ${String(pruned)} GitHub webhook deliveries older than a week`);
		}
	}
}
