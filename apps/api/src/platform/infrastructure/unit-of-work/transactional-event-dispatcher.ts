import type { PlatformEventId, PlatformEventInput } from "@workspace/shared";

import type { ActorContext } from "../../application/actor-context";
import { InTransactionEventRegistry } from "../../application/events/in-transaction-event-registry";
import { IntegrationEventMapperRegistry } from "../../application/events/integration-event-mapper";
import { TransactionalEventCollector } from "../../application/events/transactional-event-collector";
import type { DomainEvent } from "../../domain/domain-event";
import type { OutboxTransaction } from "../outbox/platform-outbox.service";

/**
 * Deeper in-transaction chains are a design smell. Fail loudly instead of looping forever.
 */
export const MAX_IN_TRANSACTION_EVENT_ROUNDS = 5;

export class InTransactionEventLoopError extends Error {
	public constructor() {
		super(`In-transaction event dispatch exceeded ${String(MAX_IN_TRANSACTION_EVENT_ROUNDS)} rounds.`);
		this.name = "InTransactionEventLoopError";
	}
}

export interface TransactionalOutboxWriter {
	enqueueInTransaction(tx: OutboxTransaction, input: PlatformEventInput): Promise<PlatformEventId>;
}

export class TransactionalEventDispatcher<TDb extends OutboxTransaction = OutboxTransaction> {
	public constructor(
		private readonly handlers: InTransactionEventRegistry<TDb>,
		private readonly mappers: IntegrationEventMapperRegistry,
		private readonly outbox: TransactionalOutboxWriter,
	) {}

	/**
	 * Runs in-transaction handlers, then outbox mappers, repeating while handlers record new events.
	 * Returns every event that should be published after the transaction commits.
	 */
	public async drain(collector: TransactionalEventCollector, db: TDb, _actor: ActorContext): Promise<readonly DomainEvent[]> {
		const committed: DomainEvent[] = [];
		for (let round = 0; round < MAX_IN_TRANSACTION_EVENT_ROUNDS; round += 1) {
			const batch = collector.take();
			if (batch.length === 0) {
				return committed;
			}
			for (const event of batch) {
				committed.push(event);
				for (const binding of this.handlers.snapshot()) {
					if (binding.accepts(event)) {
						await binding.handle(event, db, collector);
					}
				}
				const record = this.mappers.map(event);
				if (record !== null) {
					await this.outbox.enqueueInTransaction(db, record);
				}
			}
		}
		if (collector.pendingCount() > 0) {
			throw new InTransactionEventLoopError();
		}
		return committed;
	}
}
