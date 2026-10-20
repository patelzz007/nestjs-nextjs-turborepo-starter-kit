import { Inject, Injectable } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { isValidGithubWebhookSignature } from "../../../domain/policies/github-webhook-signature.policy";
import { readGithubDelivery } from "../../../domain/policies/webhook-delivery.policy";
import { githubLiveUpdatesOff, githubWebhookSignatureInvalid } from "../../errors/github.errors";
import type { GithubClock } from "../../ports/github-clock.port";
import type { GithubWebhookEndpointPort, GithubWebhookStorePort } from "../../ports/github-live-updates.port";
import { GITHUB_CLOCK, GITHUB_WEBHOOK_ENDPOINT, GITHUB_WEBHOOK_STORE } from "../../ports/github.tokens";
import { RecordGithubWebhookDeliveryCommand, type GithubWebhookOutcome } from "./record-github-webhook-delivery.command";

@Injectable()
@CommandHandler(RecordGithubWebhookDeliveryCommand)
export class RecordGithubWebhookDeliveryHandler implements ICommandHandler<RecordGithubWebhookDeliveryCommand, GithubWebhookOutcome> {
	public constructor(
		@Inject(GITHUB_WEBHOOK_ENDPOINT) private readonly endpoint: GithubWebhookEndpointPort,
		@Inject(GITHUB_WEBHOOK_STORE) private readonly deliveries: GithubWebhookStorePort,
		@Inject(GITHUB_CLOCK) private readonly clock: GithubClock,
	) {}

	public async execute(command: RecordGithubWebhookDeliveryCommand): Promise<GithubWebhookOutcome> {
		const { headers, rawBody } = command.input;
		const endpoint = this.endpoint.endpoint();
		if (endpoint === null) {
			throw githubLiveUpdatesOff();
		}
		if (!isValidGithubWebhookSignature(endpoint.secret, rawBody, headers.signature)) {
			throw githubWebhookSignatureInvalid();
		}
		const reading = readGithubDelivery(headers, rawBody);
		if (reading.kind !== "change") {
			return reading.kind;
		}
		const { change } = reading;
		const recorded = await this.deliveries.record({
			deliveryId: reading.deliveryId,
			event: reading.event,
			owner: change.owner,
			repository: change.repository,
			pullRequestNumber: change.number,
			receivedAt: this.clock.nowEpochMs(),
			announcement: JSON.stringify(change),
		});
		return recorded ? "recorded" : "duplicate";
	}
}
