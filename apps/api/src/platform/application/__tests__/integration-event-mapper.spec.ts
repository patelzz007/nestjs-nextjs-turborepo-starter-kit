import { epochMs, type PlatformEventInput } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { AmbiguousIntegrationEventMappingError, IntegrationEventMapperRegistry } from "../events/integration-event-mapper";
import { DomainEvent } from "../../domain/domain-event";

class ProbeHappened extends DomainEvent {
	public readonly eventName = "platform.ProbeHappened";

	public constructor() {
		super(epochMs(1_700_000_000_000));
	}
}

const RECORD: PlatformEventInput = {
	type: "session.action",
	payload: { action: "logout-all", userId: "8d0f3b0e-1f7a-4c55-9d1e-2f1a6b7c8d90", status: "succeeded", error: null, durationMs: 3 },
};

describe("IntegrationEventMapperRegistry", () => {
	it("returns the one mapper's payload and null when no mapper maps the event", () => {
		const registry = new IntegrationEventMapperRegistry();
		registry.register({ map: (): PlatformEventInput | null => null });
		expect(registry.map(new ProbeHappened())).toBeNull();

		registry.register({ map: (): PlatformEventInput | null => RECORD });
		expect(registry.map(new ProbeHappened())).toEqual(RECORD);
	});

	it("throws instead of silently taking the first match when two mappers map the same event", () => {
		const registry = new IntegrationEventMapperRegistry();
		registry.register({ map: (): PlatformEventInput | null => RECORD });
		registry.register({ map: (): PlatformEventInput | null => RECORD });

		expect(() => registry.map(new ProbeHappened())).toThrow(AmbiguousIntegrationEventMappingError);
	});
});
