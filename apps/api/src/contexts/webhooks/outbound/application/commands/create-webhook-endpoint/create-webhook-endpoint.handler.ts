import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { MAX_WEBHOOK_ENDPOINTS_PER_TENANT, type WebhookEndpointWithSecret } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../../platform/application/clock.port";
import type { MerchantAccessPort } from "../../../../../../platform/application/ports/authorization.port";
import type { UnitOfWork } from "../../../../../../platform/application/unit-of-work.port";
import { MERCHANT_ACCESS } from "../../../../../tenancy/public-api";
import { WebhookEndpoint } from "../../../domain/aggregates/webhook-endpoint.aggregate";
import { WebhookEndpointLimitReachedError, WebhookEndpointUrlRefusedError, WebhooksNotConfiguredError } from "../../../domain/errors/webhooks.errors";
import type { WebhookIdGenerator } from "../../ports/webhook-ids.port";
import type { WebhookSecretsPort } from "../../ports/webhook-secrets.port";
import type { WebhookUrlPolicyPort } from "../../ports/webhook-url-policy.port";
import { WEBHOOK_IDS, WEBHOOK_SECRETS, WEBHOOK_URL_POLICY, WEBHOOKS_UNIT_OF_WORK } from "../../ports/webhooks-outbound.tokens";
import { webhookEndpointSummaryOf } from "../../services/webhook-endpoint-summary";
import { assertWebhookMember } from "../../services/webhook-member";
import type { WebhooksScope } from "../../webhooks-scope";
import { CreateWebhookEndpointCommand } from "./create-webhook-endpoint.command";

/**
 * Registers an endpoint with a fresh signing secret (sealed at rest, answered this once). The tenant's endpoints are
 * locked for the transaction, so the per-tenant limit holds when two members add one at the same moment.
 */
@CommandHandler(CreateWebhookEndpointCommand)
export class CreateWebhookEndpointHandler implements ICommandHandler<CreateWebhookEndpointCommand, WebhookEndpointWithSecret> {
	public constructor(
		@Inject(WEBHOOKS_UNIT_OF_WORK) private readonly uow: UnitOfWork<WebhooksScope>,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(WEBHOOK_SECRETS) private readonly secrets: WebhookSecretsPort,
		@Inject(WEBHOOK_URL_POLICY) private readonly urls: WebhookUrlPolicyPort,
		@Inject(WEBHOOK_IDS) private readonly ids: WebhookIdGenerator,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: CreateWebhookEndpointCommand): Promise<WebhookEndpointWithSecret> {
		const { input } = command;
		const member = await assertWebhookMember(this.merchantAccess, command.actor, input.tenantId);
		if (!this.secrets.isConfigured()) {
			throw new WebhooksNotConfiguredError();
		}
		const url = this.urls.check(input.url);
		if (!url.ok) {
			throw new WebhookEndpointUrlRefusedError(url.message, url.reason);
		}
		const id = this.ids.next();
		const secret = this.secrets.create(id);
		const endpoint = WebhookEndpoint.register(
			{ id, tenantId: input.tenantId, url: input.url, description: input.description, eventTypes: input.eventTypes, secret: secret.sealed, createdByUserId: member.userId },
			this.clock.now(),
		);
		await this.uow.run(member.actor, async (scope: WebhooksScope): Promise<void> => {
			await scope.endpoints.lockTenantEndpoints(input.tenantId);
			if ((await scope.endpoints.countLive(input.tenantId)) >= MAX_WEBHOOK_ENDPOINTS_PER_TENANT) {
				throw new WebhookEndpointLimitReachedError(MAX_WEBHOOK_ENDPOINTS_PER_TENANT);
			}
			await scope.endpoints.add(endpoint);
		});
		return { endpoint: webhookEndpointSummaryOf(endpoint.snapshot), secret: secret.plaintext };
	}
}
