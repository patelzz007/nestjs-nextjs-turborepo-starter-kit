import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { WebhookEndpointSummary } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../../platform/application/clock.port";
import type { MerchantAccessPort } from "../../../../../../platform/application/ports/authorization.port";
import type { UnitOfWork } from "../../../../../../platform/application/unit-of-work.port";
import { MERCHANT_ACCESS } from "../../../../../tenancy/public-api";
import { WebhookEndpointUrlRefusedError } from "../../../domain/errors/webhooks.errors";
import type { WebhookUrlPolicyPort } from "../../ports/webhook-url-policy.port";
import { WEBHOOKS_UNIT_OF_WORK, WEBHOOK_URL_POLICY } from "../../ports/webhooks-outbound.tokens";
import { changeLiveEndpoint } from "../../services/endpoint-change";
import { webhookEndpointSummaryOf } from "../../services/webhook-endpoint-summary";
import { assertWebhookMember } from "../../services/webhook-member";
import type { WebhooksScope } from "../../webhooks-scope";
import { UpdateWebhookEndpointCommand } from "./update-webhook-endpoint.command";

/** Changes an endpoint's address, description or event types (a new address is checked like a new endpoint's). */
@CommandHandler(UpdateWebhookEndpointCommand)
export class UpdateWebhookEndpointHandler implements ICommandHandler<UpdateWebhookEndpointCommand, WebhookEndpointSummary> {
	public constructor(
		@Inject(WEBHOOKS_UNIT_OF_WORK) private readonly uow: UnitOfWork<WebhooksScope>,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(CLOCK) private readonly clock: Clock,
		@Inject(WEBHOOK_URL_POLICY) private readonly urls: WebhookUrlPolicyPort,
	) {}

	public async execute(command: UpdateWebhookEndpointCommand): Promise<WebhookEndpointSummary> {
		const { input } = command;
		const member = await assertWebhookMember(this.merchantAccess, command.actor, input.tenantId);
		if (input.url !== undefined) {
			const url = this.urls.check(input.url);
			if (!url.ok) {
				throw new WebhookEndpointUrlRefusedError(url.message, url.reason);
			}
		}
		const now = this.clock.now();
		const endpoint = await this.uow.run(member.actor, (scope: WebhooksScope) =>
			changeLiveEndpoint(scope, input.tenantId, input.endpointId, (live): void => {
				live.changeDetails(
					{
						...(input.url === undefined ? {} : { url: input.url }),
						...(input.description === undefined ? {} : { description: input.description }),
						...(input.eventTypes === undefined ? {} : { eventTypes: input.eventTypes }),
					},
					now,
				);
			}),
		);
		return webhookEndpointSummaryOf(endpoint);
	}
}
