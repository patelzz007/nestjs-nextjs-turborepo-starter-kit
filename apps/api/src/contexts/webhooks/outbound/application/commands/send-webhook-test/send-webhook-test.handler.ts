import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { epochMs, type WebhookDeliverySummary } from "@workspace/shared";

import { CLOCK, type Clock } from "../../../../../../platform/application/clock.port";
import type { MerchantAccessPort } from "../../../../../../platform/application/ports/authorization.port";
import type { UnitOfWork } from "../../../../../../platform/application/unit-of-work.port";
import { MERCHANT_ACCESS } from "../../../../../tenancy/public-api";
import { WebhookDeliveryNotFoundError, WebhookEndpointNotActiveError, WebhookEndpointNotFoundError } from "../../../domain/errors/webhooks.errors";
import { WebhookDeliveryQueued } from "../../../domain/events/webhook.events";
import type { WebhookIdGenerator } from "../../ports/webhook-ids.port";
import type { WebhooksReadPort } from "../../ports/webhooks-read.port";
import { WEBHOOK_IDS, WEBHOOK_READS, WEBHOOKS_UNIT_OF_WORK } from "../../ports/webhooks-outbound.tokens";
import { assertWebhookMember } from "../../services/webhook-member";
import type { WebhooksScope } from "../../webhooks-scope";
import { SendWebhookTestCommand } from "./send-webhook-test.command";

/** What a test event says: enough for an integrator to see the endpoint, the signature and the body work. */
const TEST_MESSAGE = "This is a test event from your webhook settings. If you can read this, the endpoint works.";

/**
 * Sends an endpoint a `webhook.test` event: one event and exactly one delivery, to this endpoint only, sent right
 * after the commit (and retried like any delivery). Answers the queued delivery, to follow in the log.
 */
@CommandHandler(SendWebhookTestCommand)
export class SendWebhookTestHandler implements ICommandHandler<SendWebhookTestCommand, WebhookDeliverySummary> {
	public constructor(
		@Inject(WEBHOOKS_UNIT_OF_WORK) private readonly uow: UnitOfWork<WebhooksScope>,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(WEBHOOK_IDS) private readonly ids: WebhookIdGenerator,
		@Inject(WEBHOOK_READS) private readonly reads: Pick<WebhooksReadPort, "findDelivery">,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: SendWebhookTestCommand): Promise<WebhookDeliverySummary> {
		const { input } = command;
		const member = await assertWebhookMember(this.merchantAccess, command.actor, input.tenantId);
		const now = epochMs(this.clock.now());
		const deliveryId = this.ids.next();
		await this.uow.run(member.actor, async (scope: WebhooksScope): Promise<void> => {
			const endpoint = await scope.endpoints.findLive(input.tenantId, input.endpointId);
			if (endpoint === null) {
				throw new WebhookEndpointNotFoundError(input.endpointId);
			}
			if (!endpoint.isActive) {
				throw new WebhookEndpointNotActiveError(input.endpointId);
			}
			const eventId = this.ids.next();
			await scope.webhookEvents.append({
				id: eventId,
				tenantId: input.tenantId,
				draft: { type: "webhook.test", data: { endpointId: input.endpointId, message: TEST_MESSAGE } },
				occurredAt: now,
			});
			await scope.deliveries.createPending([{ id: deliveryId, tenantId: input.tenantId, endpointId: input.endpointId, eventId, eventType: "webhook.test", dueAt: now }]);
			scope.events.collect(new WebhookDeliveryQueued(now, deliveryId, input.tenantId));
		});
		const delivery = await this.reads.findDelivery(member.actor, input.tenantId, deliveryId);
		if (delivery === null) {
			throw new WebhookDeliveryNotFoundError(deliveryId);
		}
		return delivery;
	}
}
