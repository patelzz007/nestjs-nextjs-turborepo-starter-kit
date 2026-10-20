import { epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { systemActor } from "../actor-context";
import { AuthorizationDeniedError } from "../../domain/errors/authorization-denied.error";
import { AggregateRoot } from "../../domain/aggregate-root";
import { DomainEvent } from "../../domain/domain-event";
import { FakeAuthorizationPort } from "./fakes/fake-authorization.port";
import { FakeMerchantAccessPort } from "./fakes/fake-merchant-access.port";
import { RecordingEventCollector } from "./fakes/recording-event-collector";

const ACTOR = systemActor("outbox.enqueue", "job", "org-1", "fake port spec", null);
const PUBLISH_REWARD = { action: "publish", resource: "Reward", resourceId: "reward-1" };

class ProbeHappened extends DomainEvent {
	public readonly eventName = "platform.ProbeHappened";

	public constructor() {
		super(epochMs(1_700_000_000_000));
	}
}

class ProbeAggregate extends AggregateRoot<ProbeHappened> {
	public happen(): void {
		this.record(new ProbeHappened());
	}
}

describe("FakeAuthorizationPort", () => {
	it("allows by default and records every check", async () => {
		const port = new FakeAuthorizationPort();

		await expect(port.assertAllowed(ACTOR, PUBLISH_REWARD)).resolves.toBeUndefined();
		expect(await port.can(ACTOR, PUBLISH_REWARD)).toBe(true);
		expect(port.checks).toHaveLength(2);
	});

	it("denies with the kernel's AuthorizationDeniedError when configured to", async () => {
		const port = new FakeAuthorizationPort("deny");

		await expect(port.assertAllowed(ACTOR, PUBLISH_REWARD)).rejects.toBeInstanceOf(AuthorizationDeniedError);
		expect(await port.can(ACTOR, PUBLISH_REWARD)).toBe(false);
	});

	it("lets one action:resource rule override the default", async () => {
		const port = new FakeAuthorizationPort("allow").decide("publish", "Reward", "deny");

		expect(await port.can(ACTOR, PUBLISH_REWARD)).toBe(false);
		expect(await port.can(ACTOR, { action: "read", resource: "Reward", resourceId: null })).toBe(true);
	});
});

describe("FakeMerchantAccessPort", () => {
	it("grants the whole tenant by default and records the request", async () => {
		const port = new FakeMerchantAccessPort();

		const grant = await port.assertCapability(ACTOR, { tenantId: "org-1", capability: "rewards:manage" });

		expect(grant).toEqual({ tenantId: "org-1", locationScope: "ALL_LOCATIONS", locationIds: [] });
		expect(port.requests).toHaveLength(1);
	});

	it("narrows the grant to the configured locations", async () => {
		const port = new FakeMerchantAccessPort().grantLocations(["loc-1"]);

		const grant = await port.assertCapability(ACTOR, { tenantId: "org-1", capability: "rewards:manage", locationId: "loc-1" });

		expect(grant).toEqual({ tenantId: "org-1", locationScope: "SELECTED", locationIds: ["loc-1"] });
	});

	it("denies a capability it was told to deny", async () => {
		const port = new FakeMerchantAccessPort().deny("rewards:manage");

		await expect(port.assertCapability(ACTOR, { tenantId: "org-1", capability: "rewards:manage" })).rejects.toBeInstanceOf(AuthorizationDeniedError);
	});
});

describe("RecordingEventCollector", () => {
	it("keeps every collected event after the pending queue was drained", () => {
		const collector = new RecordingEventCollector();
		collector.collect(new ProbeHappened());

		expect(collector.take()).toHaveLength(1);
		expect(collector.pendingCount()).toBe(0);
		expect(collector.recordedNames()).toEqual(["platform.ProbeHappened"]);
		expect(collector.recorded()).toHaveLength(1);
	});

	it("records the events it collected from an aggregate too", () => {
		const collector = new RecordingEventCollector();
		const aggregate = new ProbeAggregate();
		aggregate.happen();

		collector.collectFrom(aggregate);

		expect(collector.pendingCount()).toBe(1);
		expect(collector.recordedNames()).toEqual(["platform.ProbeHappened"]);
	});
});
