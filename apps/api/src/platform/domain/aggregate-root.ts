import type { DomainEvent } from "./domain-event";

export abstract class AggregateRoot<TEvent extends DomainEvent> {
	private readonly pendingEvents: TEvent[] = [];

	protected record(event: TEvent): void {
		this.pendingEvents.push(event);
	}

	/** Returns and clears the recorded events. Called once by the UnitOfWork collector. */
	public pullEvents(): readonly TEvent[] {
		return this.pendingEvents.splice(0, this.pendingEvents.length);
	}
}
