import { Inject, Logger } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { CaughtValueSchema } from "@workspace/shared";

import { caughtErrorLogFields } from "../../../../../../platform/application/errors/caught-error-log";
import { WebhookDeliveryQueued, WebhookEventRecorded } from "../../../domain/events/webhook.events";
import { WEBHOOK_DELIVERY_ENGINE } from "../../ports/webhook-delivery-engine.token";
import type { WebhookDeliveryEngine } from "../../services/webhook-delivery-engine";

/**
 * After the producer's commit (mechanism 2): fan the event out and make each delivery's first attempt at once, so
 * an integrator hears within seconds. A failure only logs: the event and its deliveries are durable, and the
 * sweeper takes them on its next tick.
 */
@EventsHandler(WebhookEventRecorded)
export class FanOutWebhookEventAfterCommit implements IEventHandler<WebhookEventRecorded> {
	private readonly logger: Logger = new Logger(FanOutWebhookEventAfterCommit.name);

	public constructor(@Inject(WEBHOOK_DELIVERY_ENGINE) private readonly engine: Pick<WebhookDeliveryEngine, "fanOut" | "deliverSafely">) {}

	public async handle(event: WebhookEventRecorded): Promise<void> {
		try {
			const deliveryIds = await this.engine.fanOut(event.eventId, event.tenantId);
			await Promise.all(deliveryIds.map((deliveryId: string) => this.engine.deliverSafely(deliveryId, event.tenantId)));
		} catch (error) {
			this.logger.error({ event: "webhooks.outbound.fan_out_failed", eventId: event.eventId, ...caughtErrorLogFields(CaughtValueSchema.safeParse(error).data) });
		}
	}
}

/** After a member's test or redelivery commits: send it now (the sweeper is the backstop). */
@EventsHandler(WebhookDeliveryQueued)
export class SendQueuedWebhookAfterCommit implements IEventHandler<WebhookDeliveryQueued> {
	public constructor(@Inject(WEBHOOK_DELIVERY_ENGINE) private readonly engine: Pick<WebhookDeliveryEngine, "deliverSafely">) {}

	public async handle(event: WebhookDeliveryQueued): Promise<void> {
		await this.engine.deliverSafely(event.deliveryId, event.tenantId);
	}
}
