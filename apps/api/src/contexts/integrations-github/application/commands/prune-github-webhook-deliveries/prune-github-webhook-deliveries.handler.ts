import { Inject, Injectable } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import type { GithubClock } from "../../ports/github-clock.port";
import type { GithubWebhookStorePort } from "../../ports/github-live-updates.port";
import { GITHUB_CLOCK, GITHUB_WEBHOOK_STORE } from "../../ports/github.tokens";
import { GITHUB_WEBHOOK_DELIVERY_RETENTION_MS, PruneGithubWebhookDeliveriesCommand } from "./prune-github-webhook-deliveries.command";

@Injectable()
@CommandHandler(PruneGithubWebhookDeliveriesCommand)
export class PruneGithubWebhookDeliveriesHandler implements ICommandHandler<PruneGithubWebhookDeliveriesCommand, number> {
	public constructor(
		@Inject(GITHUB_WEBHOOK_STORE) private readonly deliveries: GithubWebhookStorePort,
		@Inject(GITHUB_CLOCK) private readonly clock: GithubClock,
	) {}

	public execute(_command: PruneGithubWebhookDeliveriesCommand): Promise<number> {
		return this.deliveries.prune(this.clock.nowEpochMs() - GITHUB_WEBHOOK_DELIVERY_RETENTION_MS);
	}
}
