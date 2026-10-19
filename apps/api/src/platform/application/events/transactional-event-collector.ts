import type { AggregateRoot } from "../../domain/aggregate-root";
import type { DomainEvent } from "../../domain/domain-event";

/** Events recorded during one unit of work, drained in rounds by the dispatcher. */
export class TransactionalEventCollector {
	private readonly pending: DomainEvent[] = [];

	public collect(event: DomainEvent): void {
		this.pending.push(event);
	}

	public collectFrom(aggregate: AggregateRoot<DomainEvent>): void {
		for (const event of aggregate.pullEvents()) {
			this.pending.push(event);
		}
	}

	public pendingCount(): number {
		return this.pending.length;
	}

	/** Removes and returns every event recorded since the last take. */
	public take(): readonly DomainEvent[] {
		return this.pending.splice(0, this.pending.length);
	}
}
