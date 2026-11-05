import { Inject, Injectable } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { CLOCK, type Clock } from "../../../../../../platform/application/clock.port";
import type { ReceivedWebhookStorePort } from "../../ports/received-webhook-store.port";
import { RECEIVED_WEBHOOK_RETENTION_DAYS, RECEIVED_WEBHOOK_STORE } from "../../ports/webhooks-inbound.tokens";
import { PruneReceivedWebhooksCommand } from "./prune-received-webhooks.command";

const MS_PER_DAY = 86_400_000;

@Injectable()
@CommandHandler(PruneReceivedWebhooksCommand)
export class PruneReceivedWebhooksHandler implements ICommandHandler<PruneReceivedWebhooksCommand, number> {
	public constructor(
		@Inject(RECEIVED_WEBHOOK_STORE) private readonly store: ReceivedWebhookStorePort,
		@Inject(RECEIVED_WEBHOOK_RETENTION_DAYS) private readonly retentionDays: number,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public execute(_command: PruneReceivedWebhooksCommand): Promise<number> {
		return this.store.prune(this.clock.now() - this.retentionDays * MS_PER_DAY);
	}
}
