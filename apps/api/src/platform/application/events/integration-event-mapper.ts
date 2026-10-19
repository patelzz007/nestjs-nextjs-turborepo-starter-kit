import type { PlatformEventInput } from "@workspace/shared";

import type { DomainEvent } from "../../domain/domain-event";

/** Maps a domain event to an existing outbox payload, or null when it stays in-process. */
export interface IntegrationEventMapper {
	map(event: DomainEvent): PlatformEventInput | null;
}

/** Two mappers claimed the same domain event: which outbox payload wins would depend on registration order. */
export class AmbiguousIntegrationEventMappingError extends Error {
	public constructor(eventName: string, matches: number) {
		super(`${String(matches)} integration event mappers map ${eventName}; exactly one may.`);
		this.name = "AmbiguousIntegrationEventMappingError";
	}
}

export class IntegrationEventMapperRegistry {
	private readonly mappers: IntegrationEventMapper[] = [];

	public register(mapper: IntegrationEventMapper): void {
		this.mappers.push(mapper);
	}

	/** The one mapper's payload, or null when no mapper maps the event. Throws when more than one does. */
	public map(event: DomainEvent): PlatformEventInput | null {
		const records: PlatformEventInput[] = this.mappers.flatMap((mapper: IntegrationEventMapper): PlatformEventInput[] => {
			const record = mapper.map(event);
			return record === null ? [] : [record];
		});
		const [record, ...others] = records;
		if (others.length > 0) {
			throw new AmbiguousIntegrationEventMappingError(event.eventName, records.length);
		}
		return record ?? null;
	}
}
