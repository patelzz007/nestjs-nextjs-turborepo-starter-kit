import { Injectable } from "@nestjs/common";

import { TypedConfigService } from "../../../../config/typed-config.service";
import type { GithubWebhookEndpointPort, WebhookEndpoint } from "../../application/ports/github-live-updates.port";

/** The server's webhook settings (`GITHUB_WEBHOOK_URL` + `GITHUB_WEBHOOK_SECRET`), read on every call. */
@Injectable()
export class GithubWebhookEndpointAdapter implements GithubWebhookEndpointPort {
	public constructor(private readonly config: TypedConfigService) {}

	public endpoint(): WebhookEndpoint | null {
		return this.config.github.webhook;
	}
}
