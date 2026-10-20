import { Inject, Injectable } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { GithubLiveUpdatesStatus } from "@workspace/shared";

import { GithubLinkedCredentials } from "../../services/github-linked-credentials";
import { GithubLiveUpdatesStatusReader } from "../../services/github-live-updates-status";
import { githubUserIdOf } from "../../github-user-actor";
import { GITHUB_WEBHOOK_ENDPOINT, GITHUB_WEBHOOK_STORE, GITHUB_WEBHOOKS, GITHUB_CLOCK } from "../../ports/github.tokens";
import type { GithubClock } from "../../ports/github-clock.port";
import type { GithubWebhookEndpointPort, GithubWebhooksPort, GithubWebhookStorePort } from "../../ports/github-live-updates.port";
import { DisableLiveUpdatesCommand } from "./disable-live-updates.command";

@Injectable()
@CommandHandler(DisableLiveUpdatesCommand)
export class DisableLiveUpdatesHandler implements ICommandHandler<DisableLiveUpdatesCommand, GithubLiveUpdatesStatus> {
	public constructor(
		private readonly credentials: GithubLinkedCredentials,
		@Inject(GITHUB_WEBHOOK_ENDPOINT) private readonly endpoint: GithubWebhookEndpointPort,
		@Inject(GITHUB_WEBHOOKS) private readonly webhooks: GithubWebhooksPort,
		@Inject(GITHUB_WEBHOOK_STORE) private readonly subscriptions: GithubWebhookStorePort,
		private readonly liveUpdates: GithubLiveUpdatesStatusReader,
		@Inject(GITHUB_CLOCK) private readonly clock: GithubClock,
	) {}

	public async execute(command: DisableLiveUpdatesCommand): Promise<GithubLiveUpdatesStatus> {
		const { actor, input } = command;
		if (this.endpoint.endpoint() === null) {
			return { status: "off" };
		}
		const userId = githubUserIdOf(actor);
		const live = await this.subscriptions.findLive(input, userId);
		if (live !== null) {
			await this.credentials.withCredential(actor, (linked): Promise<void> => this.webhooks.deleteHook(linked, input, live.githubHookId));
			await this.subscriptions.release(input, live.githubHookId, userId, this.clock.nowEpochMs());
		}
		return this.liveUpdates.status(userId, input);
	}
}
