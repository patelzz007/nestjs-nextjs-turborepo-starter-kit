import { Inject, Injectable } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import { DOCS_PUBLISHING_SETTINGS, DOCS_SYNC_RUN_STORE, type DocsPublishingSettings, type DocsSyncRunStorePort } from "../../ports/docs-publishing.ports";
import { PruneDocsSyncRunsCommand } from "./prune-docs-sync-runs.command";

const MS_PER_DAY = 86_400_000;

@Injectable()
@CommandHandler(PruneDocsSyncRunsCommand)
export class PruneDocsSyncRunsHandler implements ICommandHandler<PruneDocsSyncRunsCommand, number> {
	public constructor(
		@Inject(DOCS_PUBLISHING_SETTINGS) private readonly settings: DocsPublishingSettings,
		@Inject(DOCS_SYNC_RUN_STORE) private readonly runs: DocsSyncRunStorePort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public execute(_command: PruneDocsSyncRunsCommand): Promise<number> {
		return this.runs.prune(this.clock.now() - this.settings.retentionDays * MS_PER_DAY);
	}
}
