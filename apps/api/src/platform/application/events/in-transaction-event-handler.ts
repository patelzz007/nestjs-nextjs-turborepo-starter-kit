import type { DomainEvent } from "../../domain/domain-event";
import type { TransactionalEventCollector } from "./transactional-event-collector";

/**
 * `TDb` is the transaction handle a scope factory wraps. Application code never
 * names it: infrastructure binds it to its own client (Prisma's transaction client).
 */
export interface ScopeFactory<TScope, TDb> {
	create(db: TDb, events: TransactionalEventCollector): TScope;
}

export interface InTransactionEventHandler<TEvent extends DomainEvent, TScope> {
	/** Type guard, implemented with `instanceof`; this is how we narrow without casts. */
	accepts(event: DomainEvent): event is TEvent;
	handle(event: TEvent, scope: TScope): Promise<void>;
}

export interface BoundInTransactionHandler<TDb> {
	accepts(event: DomainEvent): boolean;
	handle(event: DomainEvent, db: TDb, collector: TransactionalEventCollector): Promise<void>;
}

export function bindInTransactionHandler<TEvent extends DomainEvent, TScope, TDb>(
	handler: InTransactionEventHandler<TEvent, TScope>,
	scopeFactory: ScopeFactory<TScope, TDb>,
): BoundInTransactionHandler<TDb> {
	return {
		accepts(event: DomainEvent): boolean {
			return handler.accepts(event);
		},
		async handle(event: DomainEvent, db: TDb, collector: TransactionalEventCollector): Promise<void> {
			if (!handler.accepts(event)) {
				return;
			}
			await handler.handle(event, scopeFactory.create(db, collector));
		},
	};
}
