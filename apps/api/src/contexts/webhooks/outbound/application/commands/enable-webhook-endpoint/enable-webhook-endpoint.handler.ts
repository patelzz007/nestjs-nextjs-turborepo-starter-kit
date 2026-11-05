import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { WebhookEndpointSummary } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../../platform/application/clock.port";
import type { MerchantAccessPort } from "../../../../../../platform/application/ports/authorization.port";
import type { UnitOfWork } from "../../../../../../platform/application/unit-of-work.port";
import { MERCHANT_ACCESS } from "../../../../../tenancy/public-api";
import { WEBHOOKS_UNIT_OF_WORK } from "../../ports/webhooks-outbound.tokens";
import { changeLiveEndpoint } from "../../services/endpoint-change";
import { webhookEndpointSummaryOf } from "../../services/webhook-endpoint-summary";
import { assertWebhookMember } from "../../services/webhook-member";
import type { WebhooksScope } from "../../webhooks-scope";
import { EnableWebhookEndpointCommand } from "./enable-webhook-endpoint.command";

/** Switches an endpoint on; its failure streak starts again from zero. Enabling an active one changes nothing. */
@CommandHandler(EnableWebhookEndpointCommand)
export class EnableWebhookEndpointHandler implements ICommandHandler<EnableWebhookEndpointCommand, WebhookEndpointSummary> {
	public constructor(
		@Inject(WEBHOOKS_UNIT_OF_WORK) private readonly uow: UnitOfWork<WebhooksScope>,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: EnableWebhookEndpointCommand): Promise<WebhookEndpointSummary> {
		const { input } = command;
		const member = await assertWebhookMember(this.merchantAccess, command.actor, input.tenantId);
		const now = this.clock.now();
		const endpoint = await this.uow.run(member.actor, (scope: WebhooksScope) =>
			changeLiveEndpoint(scope, input.tenantId, input.endpointId, (live): void => {
				live.enable(now);
			}),
		);
		return webhookEndpointSummaryOf(endpoint);
	}
}
