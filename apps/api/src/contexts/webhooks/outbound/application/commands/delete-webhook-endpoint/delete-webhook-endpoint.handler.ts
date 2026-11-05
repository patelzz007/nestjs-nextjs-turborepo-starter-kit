import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { DeleteSuccessData } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../../platform/application/clock.port";
import type { MerchantAccessPort } from "../../../../../../platform/application/ports/authorization.port";
import type { UnitOfWork } from "../../../../../../platform/application/unit-of-work.port";
import { MERCHANT_ACCESS } from "../../../../../tenancy/public-api";
import { WEBHOOKS_UNIT_OF_WORK } from "../../ports/webhooks-outbound.tokens";
import { changeLiveEndpoint } from "../../services/endpoint-change";
import { assertWebhookMember } from "../../services/webhook-member";
import type { WebhooksScope } from "../../webhooks-scope";
import { DeleteWebhookEndpointCommand } from "./delete-webhook-endpoint.command";

/** Removes an endpoint (soft delete). Its deliveries stay in the log; open ones are cancelled when their turn comes. */
@CommandHandler(DeleteWebhookEndpointCommand)
export class DeleteWebhookEndpointHandler implements ICommandHandler<DeleteWebhookEndpointCommand, DeleteSuccessData> {
	public constructor(
		@Inject(WEBHOOKS_UNIT_OF_WORK) private readonly uow: UnitOfWork<WebhooksScope>,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: DeleteWebhookEndpointCommand): Promise<DeleteSuccessData> {
		const { input } = command;
		const member = await assertWebhookMember(this.merchantAccess, command.actor, input.tenantId);
		const now = this.clock.now();
		await this.uow.run(member.actor, (scope: WebhooksScope) =>
			changeLiveEndpoint(scope, input.tenantId, input.endpointId, (live): void => {
				live.remove(now);
			}),
		);
		return { success: true };
	}
}
