import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { GITHUB_CLOCK } from "../github-contributions.service";
import type { GithubClock } from "../github-response.cache";
import { GithubWebhookRepository } from "./github-webhook.repository";

/**
 * How long a delivery is kept: GitHub redelivers automatically within minutes and lets a person
 * redeliver by hand for 3 days, so a week covers every redelivery with room to spare.
 */
export const GITHUB_WEBHOOK_DELIVERY_RETENTION_MS = 604_800_000;

/**
 * Prunes recorded GitHub webhook deliveries past their retention, hourly. They
 * exist only to recognise redeliveries (ADR 052); each run is one bounded
 * DELETE on the `received_at` index, safe on every instance at once.
 */
@Injectable()
export class GithubWebhookDeliveryRetention {
	private readonly logger: Logger = new Logger(GithubWebhookDeliveryRetention.name);

	public constructor(
		private readonly deliveries: GithubWebhookRepository,
		@Inject(GITHUB_CLOCK) private readonly clock: GithubClock,
	) {}

	@Cron(CronExpression.EVERY_HOUR)
	public async prune(): Promise<void> {
		const pruned = await this.deliveries.prune(this.clock.nowEpochMs() - GITHUB_WEBHOOK_DELIVERY_RETENTION_MS);
		if (pruned > 0) {
			this.logger.log(`Pruned ${String(pruned)} GitHub webhook deliveries older than a week`);
		}
	}
}
