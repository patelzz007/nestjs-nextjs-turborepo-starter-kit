import type { TierDomainEvent } from "../../domain/events/tier.events";

/**
 * Tells the customer what happened to their tier (ADR 085), in the evaluation's own transaction, so the notice commits
 * with the change or not at all: a promotion and a warning by push and in the inbox, a demotion in the inbox only.
 */
export interface TierNoticesPort {
	send(event: TierDomainEvent): Promise<void>;
}
