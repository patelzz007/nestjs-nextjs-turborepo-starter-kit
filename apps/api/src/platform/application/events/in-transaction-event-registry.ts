import type { BoundInTransactionHandler } from "./in-transaction-event-handler";

/** The in-transaction handlers of one transaction client type, in registration order. */
export class InTransactionEventRegistry<TDb> {
	private readonly handlers: BoundInTransactionHandler<TDb>[] = [];

	public register(handler: BoundInTransactionHandler<TDb>): void {
		this.handlers.push(handler);
	}

	/** A copy: a handler registered while a drain iterates does not change that drain. */
	public snapshot(): readonly BoundInTransactionHandler<TDb>[] {
		return [...this.handlers];
	}
}
