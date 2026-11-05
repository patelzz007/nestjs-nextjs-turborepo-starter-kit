import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { systemActor } from "../../../../../platform/application/actor-context";
import { SystemCommandDispatcher } from "../../../../../platform/application/system-command-dispatcher";
import { PruneReceivedWebhooksCommand } from "../../application/commands/prune-received-webhooks/prune-received-webhooks.command";
import { WEBHOOKS_INBOUND_RECORD_OPERATION } from "../../application/ports/webhooks-inbound.tokens";

/** The cron's name on its audit row. */
const RETENTION_CRON_NAME = "ReceivedWebhookRetentionCron.prune";

/**
 * Prunes received webhooks past their retention, hourly — a system command, audited by the dispatcher.
 * Each run is one bounded DELETE, safe on every instance at once.
 */
@Injectable()
export class ReceivedWebhookRetentionCron {
	private readonly logger: Logger = new Logger(ReceivedWebhookRetentionCron.name);

	public constructor(@Inject(SystemCommandDispatcher) private readonly dispatcher: Pick<SystemCommandDispatcher, "dispatch">) {}

	@Cron(CronExpression.EVERY_HOUR)
	public async prune(): Promise<void> {
		const actor = systemActor(WEBHOOKS_INBOUND_RECORD_OPERATION, "cron", null, "Prune received webhooks past their retention", null);
		const pruned = await this.dispatcher.dispatch(new PruneReceivedWebhooksCommand(actor), { kind: "cron", name: RETENTION_CRON_NAME });
		if (pruned > 0) {
			this.logger.log(`Pruned ${String(pruned)} received webhooks past their retention`);
		}
	}
}
