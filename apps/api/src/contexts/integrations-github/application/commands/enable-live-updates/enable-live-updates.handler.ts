import { Inject, Injectable } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { GithubLiveUpdatesParams, GithubLiveUpdatesStatus } from "@workspace/shared";

import { GithubLinkedCredentials } from "../../services/github-linked-credentials";
import { GithubLiveUpdatesStatusReader } from "../../services/github-live-updates-status";
import { githubUserIdOf } from "../../github-user-actor";
import { GITHUB_WEBHOOK_ENDPOINT, GITHUB_WEBHOOK_STORE, GITHUB_WEBHOOKS } from "../../ports/github.tokens";
import { githubLiveUpdatesOff, GithubWriteRejectedError } from "../../errors/github.errors";
import type { LinkedGithubCredential } from "../../ports/github-credentials.port";
import type { GithubWebhookEndpointPort, GithubWebhooksPort, GithubWebhookStorePort, WebhookEndpoint } from "../../ports/github-live-updates.port";
import { EnableLiveUpdatesCommand } from "./enable-live-updates.command";

@Injectable()
@CommandHandler(EnableLiveUpdatesCommand)
export class EnableLiveUpdatesHandler implements ICommandHandler<EnableLiveUpdatesCommand, GithubLiveUpdatesStatus> {
	public constructor(
		private readonly credentials: GithubLinkedCredentials,
		@Inject(GITHUB_WEBHOOK_ENDPOINT) private readonly endpoint: GithubWebhookEndpointPort,
		@Inject(GITHUB_WEBHOOKS) private readonly webhooks: GithubWebhooksPort,
		@Inject(GITHUB_WEBHOOK_STORE) private readonly subscriptions: GithubWebhookStorePort,
		private readonly liveUpdates: GithubLiveUpdatesStatusReader,
	) {}

	public async execute(command: EnableLiveUpdatesCommand): Promise<GithubLiveUpdatesStatus> {
		const { actor, input } = command;
		const endpoint = this.endpoint.endpoint();
		if (endpoint === null) {
			throw githubLiveUpdatesOff();
		}
		const userId = githubUserIdOf(actor);
		const current = await this.liveUpdates.status(userId, input);
		if (current.status === "enabled") {
			return current;
		}
		await this.credentials.withCredential(actor, async (linked): Promise<void> => {
			const hookId = await this.createOrAdoptHook(linked, input, endpoint);
			const claimed = await this.subscriptions.claim(input, hookId, userId);
			const live = claimed ? null : await this.subscriptions.findLive(input, userId);
			if (live !== null && live.githubHookId !== hookId) {
				// Someone else's hook won the row; ours would deliver every change twice.
				await this.webhooks.deleteHook(linked, input, hookId);
			}
		});
		return this.liveUpdates.status(userId, input);
	}

	/** GitHub answers a second hook with the same address on one repository 422: the existing one is adopted instead. */
	private async createOrAdoptHook(linked: LinkedGithubCredential, params: GithubLiveUpdatesParams, endpoint: WebhookEndpoint): Promise<bigint> {
		try {
			return await this.webhooks.createHook(linked, params, endpoint);
		} catch (error: unknown) {
			if (error instanceof GithubWriteRejectedError && error.refusal === "unprocessable") {
				return this.webhooks.createHook(linked, params, endpoint);
			}
			throw error;
		}
	}
}
