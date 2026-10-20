import { TransactionalEventCollector } from "../../events/transactional-event-collector";
import type { AggregateRoot } from "../../../domain/aggregate-root";
import type { DomainEvent } from "../../../domain/domain-event";

/**
 * A real {@link TransactionalEventCollector} that also keeps every event ever
 * collected, so a test can assert what a handler recorded after the dispatcher
 * already drained the pending queue.
 */
export class RecordingEventCollector extends TransactionalEventCollector {
	private readonly history: DomainEvent[] = [];

	public override collect(event: DomainEvent): void {
		this.history.push(event);
		super.collect(event);
	}

	public override collectFrom(aggregate: AggregateRoot<DomainEvent>): void {
		for (const event of aggregate.pullEvents()) {
			this.collect(event);
		}
	}

	/** Every event collected, in order, drained or not. */
	public recorded(): readonly DomainEvent[] {
		return [...this.history];
	}

	/** The names of every event collected, in order. */
	public recordedNames(): readonly string[] {
		return this.history.map((event: DomainEvent): string => event.eventName);
	}
}
