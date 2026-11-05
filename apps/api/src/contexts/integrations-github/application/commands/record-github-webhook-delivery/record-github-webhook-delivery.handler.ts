import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import {
	GITHUB_WEBHOOK_PROFILE,
	INBOUND_WEBHOOK_RECEIVER,
	type InboundWebhookHandling,
	type InboundWebhookReceiverPort,
	type InboundWebhookRequest,
} from "../../../../webhooks/inbound/public-api";
import { GITHUB_SIGNATURE_SCHEME, githubSignatureVerifier } from "../../../domain/policies/github-webhook-signature.policy";
import { readGithubDelivery } from "../../../domain/policies/webhook-delivery.policy";
import { githubLiveUpdatesOff, githubWebhookSignatureInvalid } from "../../errors/github.errors";
import type { GithubClock } from "../../ports/github-clock.port";
import type { GithubWebhookEndpointPort, GithubWebhookStorePort } from "../../ports/github-live-updates.port";
import { GITHUB_CLOCK, GITHUB_WEBHOOK_ENDPOINT, GITHUB_WEBHOOK_STORE } from "../../ports/github.tokens";
import { RecordGithubWebhookDeliveryCommand, type GithubWebhookOutcome } from "./record-github-webhook-delivery.command";

const EVENT_HEADER = "x-github-event";
const DELIVERY_HEADER = "x-github-delivery";

@Injectable()
@CommandHandler(RecordGithubWebhookDeliveryCommand)
export class RecordGithubWebhookDeliveryHandler implements ICommandHandler<RecordGithubWebhookDeliveryCommand, GithubWebhookOutcome> {
	public constructor(
		@Inject(GITHUB_WEBHOOK_ENDPOINT) private readonly endpoint: GithubWebhookEndpointPort,
		@Inject(GITHUB_WEBHOOK_STORE) private readonly deliveries: GithubWebhookStorePort,
		@Inject(GITHUB_CLOCK) private readonly clock: GithubClock,
		@Inject(INBOUND_WEBHOOK_RECEIVER) private readonly receiver: InboundWebhookReceiverPort,
	) {}

	public async execute(command: RecordGithubWebhookDeliveryCommand): Promise<GithubWebhookOutcome> {
		const { request } = command.input;
		const endpoint = this.endpoint.endpoint();
		const reception = await this.receiver.receive<GithubWebhookOutcome>({
			actor: command.actor,
			profile: GITHUB_WEBHOOK_PROFILE,
			request,
			// 503 GITHUB_LIVE_UPDATES_OFF when this server receives no webhooks; 403 for a bad signature.
			verifier: endpoint === null ? null : githubSignatureVerifier(endpoint.secret),
			successStatus: HttpStatus.OK,
			notConfigured: githubLiveUpdatesOff,
			rejected: githubWebhookSignatureInvalid,
			handle: async (): Promise<InboundWebhookHandling<GithubWebhookOutcome>> => this.record(request),
		});
		return reception.kind === "duplicate" ? "duplicate" : reception.result;
	}

	/** A verified, first-seen delivery: GitHub's own table records its change once and announces it. */
	private async record(request: InboundWebhookRequest): Promise<InboundWebhookHandling<GithubWebhookOutcome>> {
		const headers = { event: request.headers[EVENT_HEADER], deliveryId: request.headers[DELIVERY_HEADER], signature: request.headers[GITHUB_SIGNATURE_SCHEME.header] };
		const reading = readGithubDelivery(headers, request.rawBody);
		if (reading.kind !== "change") {
			return { outcome: "IGNORED", result: reading.kind };
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
		return recorded ? { outcome: "RECORDED", result: "recorded" } : { outcome: "DUPLICATE", result: "duplicate" };
	}
}
