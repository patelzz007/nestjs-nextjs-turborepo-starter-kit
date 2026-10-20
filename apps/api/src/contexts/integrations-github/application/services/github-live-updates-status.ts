import { Inject, Injectable } from "@nestjs/common";
import { epochMs, type GithubLiveUpdatesParams, type GithubLiveUpdatesStatus } from "@workspace/shared";

import type { GithubWebhookEndpointPort, GithubWebhookStorePort } from "../ports/github-live-updates.port";
import { GITHUB_WEBHOOK_ENDPOINT, GITHUB_WEBHOOK_STORE } from "../ports/github.tokens";

/** Whether a repository's pull requests update live: `off` (no webhooks on this server), `disabled` or `enabled`. */
@Injectable()
export class GithubLiveUpdatesStatusReader {
	public constructor(
		@Inject(GITHUB_WEBHOOK_ENDPOINT) private readonly endpoint: GithubWebhookEndpointPort,
		@Inject(GITHUB_WEBHOOK_STORE) private readonly subscriptions: GithubWebhookStorePort,
	) {}

	public async status(userId: string, params: GithubLiveUpdatesParams): Promise<GithubLiveUpdatesStatus> {
		if (this.endpoint.endpoint() === null) {
			return { status: "off" };
		}
		const live = await this.subscriptions.findLive(params, userId);
		return live === null ? { status: "disabled" } : { status: "enabled", enabledAt: epochMs(live.createdAt) };
	}
}
