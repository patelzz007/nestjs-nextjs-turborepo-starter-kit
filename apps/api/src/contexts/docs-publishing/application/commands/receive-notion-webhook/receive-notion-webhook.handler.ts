import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { AuthorizationError, DependencyUnavailableError, ExternalServiceError } from "../../../../../platform/application/errors/app-error";
import { OPERATIONAL_ALERTS, type OperationalAlertPort } from "../../../../../platform/application/ports/operational-alert.port";
import {
	INBOUND_WEBHOOK_RECEIVER,
	NOTION_WEBHOOK_PROFILE,
	type InboundWebhookEnvelope,
	type InboundWebhookHandling,
	type InboundWebhookReceiverPort,
} from "../../../../webhooks/inbound/public-api";
import { handshakeTokenOf, notionSignatureVerifier, warrantsSync } from "../../../domain/notion-webhook.policy";
import {
	DOCS_PUBLISHING_SETTINGS,
	DOCS_SYNC_DISPATCHER,
	DOCS_WEBHOOK_HANDSHAKE_STORE,
	type DocsPublishingSettings,
	type DocsSyncDispatcherPort,
	type DocsWebhookHandshakeStorePort,
} from "../../ports/docs-publishing.ports";
import { ReceiveNotionWebhookCommand, type NotionWebhookOutcome } from "./receive-notion-webhook.command";

/**
 * Notion's webhook (plan §11). It only ever starts the sync: it fetches nothing and converts nothing, and it passes
 * nothing from the request on to GitHub, so a forged body could at worst start one more sync. Webhooks are not
 * trusted for correctness: the 15-minute and nightly syncs catch anything missed.
 *
 * Before a secret is configured the only request it acts on is the handshake. After, every request must be signed.
 */
@Injectable()
@CommandHandler(ReceiveNotionWebhookCommand)
export class ReceiveNotionWebhookHandler implements ICommandHandler<ReceiveNotionWebhookCommand, NotionWebhookOutcome> {
	public constructor(
		@Inject(DOCS_PUBLISHING_SETTINGS) private readonly settings: DocsPublishingSettings,
		@Inject(INBOUND_WEBHOOK_RECEIVER) private readonly receiver: InboundWebhookReceiverPort,
		@Inject(DOCS_WEBHOOK_HANDSHAKE_STORE) private readonly handshakes: DocsWebhookHandshakeStorePort,
		@Inject(DOCS_SYNC_DISPATCHER) private readonly dispatcher: DocsSyncDispatcherPort | null,
		@Inject(OPERATIONAL_ALERTS) private readonly alerts: OperationalAlertPort,
	) {}

	public async execute({ actor, request }: ReceiveNotionWebhookCommand): Promise<NotionWebhookOutcome> {
		const secret = this.settings.notionWebhookSecret;
		if (secret === null) {
			const token = handshakeTokenOf(request);
			if (token !== null) {
				await this.handshakes.put("NOTION", token);
				return "handshake";
			}
		}
		const reception = await this.receiver.receive<NotionWebhookOutcome>({
			actor,
			profile: NOTION_WEBHOOK_PROFILE,
			request,
			verifier: secret === null ? null : notionSignatureVerifier(secret),
			successStatus: HttpStatus.OK,
			notConfigured: () => new DependencyUnavailableError({ message: "This server has no Notion webhook secret yet." }),
			rejected: () => new AuthorizationError({ message: "The webhook signature is not valid." }),
			handle: (envelope) => this.handle(envelope),
		});
		return reception.kind === "duplicate" ? "duplicate" : reception.result;
	}

	private async handle(envelope: InboundWebhookEnvelope): Promise<InboundWebhookHandling<NotionWebhookOutcome>> {
		if (!warrantsSync(envelope.eventType) || this.dispatcher === null) {
			return { outcome: "IGNORED", result: "ignored" };
		}
		try {
			await this.dispatcher.dispatch({ trigger: "WEBHOOK", full: false });
		} catch (error) {
			this.alerts.raise({
				event: "docs_publishing.dispatch_failed",
				message: "A Notion change could not start the docs sync. The scheduled sync will pick it up.",
				facts: { eventType: envelope.eventType },
			});
			// Answered 502, so Notion retries the event.
			throw new ExternalServiceError({ message: "The docs sync could not be started.", ...(error instanceof Error ? { cause: error } : {}) });
		}
		return { outcome: "RECORDED", result: "dispatched" };
	}
}
