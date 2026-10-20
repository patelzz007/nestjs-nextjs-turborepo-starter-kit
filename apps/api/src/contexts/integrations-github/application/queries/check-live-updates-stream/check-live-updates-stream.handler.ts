import { Inject, Injectable } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";

import { GithubLinkedCredentials } from "../../services/github-linked-credentials";
import { githubLiveUpdatesOff, githubRepositoryNotVisible } from "../../errors/github.errors";
import type { GithubWebhookEndpointPort, GithubWebhooksPort } from "../../ports/github-live-updates.port";
import { GITHUB_WEBHOOK_ENDPOINT, GITHUB_WEBHOOKS } from "../../ports/github.tokens";
import { CheckLiveUpdatesStreamQuery } from "./check-live-updates-stream.query";

@Injectable()
@QueryHandler(CheckLiveUpdatesStreamQuery)
export class CheckLiveUpdatesStreamHandler implements IQueryHandler<CheckLiveUpdatesStreamQuery, void> {
	public constructor(
		private readonly credentials: GithubLinkedCredentials,
		@Inject(GITHUB_WEBHOOK_ENDPOINT) private readonly endpoint: GithubWebhookEndpointPort,
		@Inject(GITHUB_WEBHOOKS) private readonly webhooks: GithubWebhooksPort,
	) {}

	public async execute(query: CheckLiveUpdatesStreamQuery): Promise<void> {
		if (this.endpoint.endpoint() === null) {
			throw githubLiveUpdatesOff();
		}
		const visible = await this.credentials.withCredential(query.actor, (linked) => this.webhooks.canSee(linked, query.input));
		if (!visible) {
			throw githubRepositoryNotVisible();
		}
	}
}
