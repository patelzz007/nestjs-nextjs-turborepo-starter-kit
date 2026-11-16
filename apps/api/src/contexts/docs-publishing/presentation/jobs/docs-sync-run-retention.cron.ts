import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { systemActor } from "../../../../platform/application/actor-context";
import { SystemCommandDispatcher } from "../../../../platform/application/system-command-dispatcher";
import { PruneDocsSyncRunsCommand } from "../../application/commands/prune-docs-sync-runs/prune-docs-sync-runs.command";
import { DOCS_PUBLISHING_RECORD_OPERATION } from "../../application/ports/docs-publishing.ports";

/** The cron's name on its audit row. */
const RETENTION_CRON_NAME = "DocsSyncRunRetentionCron.prune";

/** Prunes docs sync runs past their retention, daily: a system command, audited by the dispatcher. */
@Injectable()
export class DocsSyncRunRetentionCron {
	private readonly logger: Logger = new Logger(DocsSyncRunRetentionCron.name);

	public constructor(@Inject(SystemCommandDispatcher) private readonly dispatcher: Pick<SystemCommandDispatcher, "dispatch">) {}

	@Cron(CronExpression.EVERY_DAY_AT_3AM)
	public async prune(): Promise<void> {
		const actor = systemActor(DOCS_PUBLISHING_RECORD_OPERATION, "cron", null, "Prune docs sync runs past their retention", null);
		const pruned = await this.dispatcher.dispatch(new PruneDocsSyncRunsCommand(actor), { kind: "cron", name: RETENTION_CRON_NAME });
		if (pruned > 0) {
			this.logger.log(`Pruned ${String(pruned)} docs sync runs past their retention`);
		}
	}
}
