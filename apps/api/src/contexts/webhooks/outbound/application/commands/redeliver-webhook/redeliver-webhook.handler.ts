import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { epochMs, type WebhookDeliverySummary } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../../platform/application/clock.port";
import type { MerchantAccessPort } from "../../../../../../platform/application/ports/authorization.port";
import type { UnitOfWork } from "../../../../../../platform/application/unit-of-work.port";
import { MERCHANT_ACCESS } from "../../../../../tenancy/public-api";
import { WebhookDeliveryInProgressError, WebhookDeliveryNotFoundError, WebhookEndpointNotActiveError } from "../../../domain/errors/webhooks.errors";
import { WebhookDeliveryQueued } from "../../../domain/events/webhook.events";
import type { WebhooksReadPort } from "../../ports/webhooks-read.port";
import { WEBHOOK_READS, WEBHOOKS_UNIT_OF_WORK } from "../../ports/webhooks-outbound.tokens";
import { assertWebhookMember } from "../../services/webhook-member";
import type { WebhooksScope } from "../../webhooks-scope";
import { RedeliverWebhookCommand } from "./redeliver-webhook.command";

/**
 * Sends a settled delivery (succeeded, gave up or cancelled) again, from attempt one, with the same `Webhook-Id`
 * (a receiver that already processed it can drop the repeat). One still being retried is refused: it is queued.
 */
@CommandHandler(RedeliverWebhookCommand)
export class RedeliverWebhookHandler implements ICommandHandler<RedeliverWebhookCommand, WebhookDeliverySummary> {
	public constructor(
		@Inject(WEBHOOKS_UNIT_OF_WORK) private readonly uow: UnitOfWork<WebhooksScope>,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(WEBHOOK_READS) private readonly reads: Pick<WebhooksReadPort, "findDelivery">,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: RedeliverWebhookCommand): Promise<WebhookDeliverySummary> {
		const { input } = command;
		const member = await assertWebhookMember(this.merchantAccess, command.actor, input.tenantId);
		const now = epochMs(this.clock.now());
		await this.uow.run(member.actor, async (scope: WebhooksScope): Promise<void> => {
			const delivery = await scope.deliveries.findInTenant(input.tenantId, input.deliveryId);
			if (delivery === null) {
				throw new WebhookDeliveryNotFoundError(input.deliveryId);
			}
			if (delivery.status === "PENDING" || delivery.status === "FAILED") {
				throw new WebhookDeliveryInProgressError(input.deliveryId);
			}
			const endpoint = await scope.endpoints.findLive(input.tenantId, delivery.endpointId);
			if (endpoint === null || !endpoint.isActive) {
				throw new WebhookEndpointNotActiveError(delivery.endpointId);
			}
			if (!(await scope.deliveries.requeue(delivery.id, delivery.status, now))) {
				throw new WebhookDeliveryInProgressError(input.deliveryId);
			}
			scope.events.collect(new WebhookDeliveryQueued(now, delivery.id, input.tenantId));
		});
		const delivery = await this.reads.findDelivery(member.actor, input.tenantId, input.deliveryId);
		if (delivery === null) {
			throw new WebhookDeliveryNotFoundError(input.deliveryId);
		}
		return delivery;
	}
}
