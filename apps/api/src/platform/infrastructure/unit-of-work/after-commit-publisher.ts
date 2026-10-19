import type { DomainEvent } from "../../domain/domain-event";

/** Publishes a domain event in-process once its unit of work committed. The Nest `EventBus` is the adapter. */
export interface AfterCommitPublisher {
	publish(event: DomainEvent): Promise<void>;
}
