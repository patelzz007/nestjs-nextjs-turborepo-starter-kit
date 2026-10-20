import { Injectable } from "@nestjs/common";
import type { GithubRepositoryParams } from "@workspace/shared";

import type { LinkedGithubCredential } from "../../application/ports/github-credentials.port";
import type { GithubWebhooksPort, WebhookEndpoint } from "../../application/ports/github-live-updates.port";
import { GithubWebhooksClient } from "../github-api/github-webhooks.client";
import { linkedTransportCredential } from "./linked-credential";

/** Repository webhooks on GitHub, with the caller's token ("Webhooks: Read and write"). */
@Injectable()
export class GithubWebhooksAdapter implements GithubWebhooksPort {
	public constructor(private readonly client: GithubWebhooksClient) {}

	public canSee(linked: LinkedGithubCredential, repository: GithubRepositoryParams): Promise<boolean> {
		return this.client.canSee(linkedTransportCredential(linked), repository);
	}

	public createHook(linked: LinkedGithubCredential, repository: GithubRepositoryParams, endpoint: WebhookEndpoint): Promise<bigint> {
		return this.client.createHook(linkedTransportCredential(linked), repository, endpoint);
	}

	public deleteHook(linked: LinkedGithubCredential, repository: GithubRepositoryParams, hookId: bigint): Promise<void> {
		return this.client.deleteHook(linkedTransportCredential(linked), repository, hookId);
	}
}
