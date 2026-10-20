import { epochMs, type EpochMs, type PlatformEventId, type PlatformEventInput } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { systemActor } from "../../../application/actor-context";
import { FixedClock } from "../../../application/__tests__/fixed-clock";
import { bindInTransactionHandler, type InTransactionEventHandler } from "../../../application/events/in-transaction-event-handler";
import { InTransactionEventRegistry } from "../../../application/events/in-transaction-event-registry";
import { IntegrationEventMapperRegistry, type IntegrationEventMapper } from "../../../application/events/integration-event-mapper";
import { TransactionalEventCollector } from "../../../application/events/transactional-event-collector";
import { AggregateRoot } from "../../../domain/aggregate-root";
import { DomainEvent } from "../../../domain/domain-event";
import type { OutboxTransaction } from "../../outbox/platform-outbox.service";
import { InTransactionEventLoopError, TransactionalEventDispatcher, type TransactionalOutboxWriter } from "../transactional-event-dispatcher";

/** 2026-10-17T00:00:00.000Z */
const FIXTURE_INSTANT_EPOCH_MS = 1_792_195_200_000;
const NOW: EpochMs = epochMs(FIXTURE_INSTANT_EPOCH_MS);
const ACTOR = systemActor("outbox.enqueue", "job", null, "Count statements for a test", null);
const EVENT_ID: PlatformEventId = "8d0f3b0e-1f7a-4c55-9d1e-2f1a6b7c8d90";
const OUTBOX_RECORD: PlatformEventInput = {
	type: "session.action",
	payload: { action: "logout-all", userId: EVENT_ID, status: "succeeded", error: null, durationMs: 3 },
};

class RewardPublished extends DomainEvent {
	public readonly eventName = "rewards.RewardPublished";

	public constructor(occurredAt: EpochMs) {
		super(occurredAt);
	}
}

class RewardFollowedUp extends DomainEvent {
	public readonly eventName = "rewards.RewardFollowedUp";

	public constructor(occurredAt: EpochMs) {
		super(occurredAt);
	}
}

class RecordingAggregate extends AggregateRoot<RewardPublished> {
	public publish(now: EpochMs): void {
		this.record(new RewardPublished(now));
	}
}

const DATABASE: OutboxTransaction = {
	outboxEvent: {
		createMany: (): Promise<{ readonly count: number }> => Promise.resolve({ count: 1 }),
	},
};

function writer(trace: string[]): TransactionalOutboxWriter {
	return {
		enqueueInTransaction: (): Promise<PlatformEventId> => {
			trace.push("outbox");
			return Promise.resolve(EVENT_ID);
		},
	};
}

function mapper(trace: string[], recordFor: string): IntegrationEventMapper {
	return {
		map(event: DomainEvent): PlatformEventInput | null {
			if (event.eventName !== recordFor) {
				return null;
			}
			trace.push(`map:${event.eventName}`);
			return OUTBOX_RECORD;
		},
	};
}

function dispatcher(trace: string[], registry: InTransactionEventRegistry<OutboxTransaction>, recordFor: string): TransactionalEventDispatcher {
	const mappers = new IntegrationEventMapperRegistry();
	mappers.register(mapper(trace, recordFor));
	return new TransactionalEventDispatcher(registry, mappers, writer(trace));
}

describe("TransactionalEventDispatcher", () => {
	it("pulls aggregate events once", () => {
		const aggregate = new RecordingAggregate();
		aggregate.publish(new FixedClock(NOW).now());
		const collector = new TransactionalEventCollector();
		collector.collectFrom(aggregate);
		expect(collector.pendingCount()).toBe(1);
		expect(aggregate.pullEvents()).toEqual([]);
	});

	it("runs in-transaction handlers before the outbox mapper and returns the events to publish after commit", async () => {
		const trace: string[] = [];
		const registry = new InTransactionEventRegistry<OutboxTransaction>();
		const handler: InTransactionEventHandler<RewardPublished, TransactionalEventCollector> = {
			accepts(event: DomainEvent): event is RewardPublished {
				return event instanceof RewardPublished;
			},
			handle: (event: RewardPublished): Promise<void> => {
				trace.push(`handle:${event.eventName}`);
				return Promise.resolve();
			},
		};
		registry.register(bindInTransactionHandler(handler, { create: (_db, events) => events }));
		const collector = new TransactionalEventCollector();
		collector.collect(new RewardPublished(NOW));

		const toPublish = await dispatcher(trace, registry, "rewards.RewardPublished").drain(collector, DATABASE, ACTOR);

		expect(trace).toEqual(["handle:rewards.RewardPublished", "map:rewards.RewardPublished", "outbox"]);
		expect(toPublish.map((event: DomainEvent): string => event.eventName)).toEqual(["rewards.RewardPublished"]);
	});

	it("does not let a handler registered during a drain join that drain", async () => {
		const trace: string[] = [];
		const registry = new InTransactionEventRegistry<OutboxTransaction>();
		const late: InTransactionEventHandler<RewardPublished, TransactionalEventCollector> = {
			accepts(event: DomainEvent): event is RewardPublished {
				return event instanceof RewardPublished;
			},
			handle: (): Promise<void> => {
				trace.push("late");
				return Promise.resolve();
			},
		};
		const registering: InTransactionEventHandler<RewardPublished, TransactionalEventCollector> = {
			accepts(event: DomainEvent): event is RewardPublished {
				return event instanceof RewardPublished;
			},
			handle: (): Promise<void> => {
				trace.push("registering");
				registry.register(bindInTransactionHandler(late, { create: (_db, events) => events }));
				return Promise.resolve();
			},
		};
		registry.register(bindInTransactionHandler(registering, { create: (_db, events) => events }));
		const collector = new TransactionalEventCollector();
		collector.collect(new RewardPublished(NOW));

		await dispatcher(trace, registry, "none").drain(collector, DATABASE, ACTOR);

		expect(trace).toEqual(["registering"]);
	});

	it("processes an event recorded by a handler on the next round", async () => {
		const trace: string[] = [];
		const registry = new InTransactionEventRegistry<OutboxTransaction>();
		const handler: InTransactionEventHandler<RewardPublished, TransactionalEventCollector> = {
			accepts(event: DomainEvent): event is RewardPublished {
				return event instanceof RewardPublished;
			},
			handle: (event: RewardPublished, events: TransactionalEventCollector): Promise<void> => {
				trace.push(`handle:${event.eventName}`);
				events.collect(new RewardFollowedUp(event.occurredAt));
				return Promise.resolve();
			},
		};
		const followUp: InTransactionEventHandler<RewardFollowedUp, TransactionalEventCollector> = {
			accepts(event: DomainEvent): event is RewardFollowedUp {
				return event instanceof RewardFollowedUp;
			},
			handle: (event: RewardFollowedUp): Promise<void> => {
				trace.push(`handle:${event.eventName}`);
				return Promise.resolve();
			},
		};
		registry.register(bindInTransactionHandler(handler, { create: (_db, events) => events }));
		registry.register(bindInTransactionHandler(followUp, { create: (_db, events) => events }));
		const collector = new TransactionalEventCollector();
		collector.collect(new RewardPublished(NOW));

		await dispatcher(trace, registry, "rewards.RewardPublished").drain(collector, DATABASE, ACTOR);

		expect(trace).toEqual(["handle:rewards.RewardPublished", "map:rewards.RewardPublished", "outbox", "handle:rewards.RewardFollowedUp"]);
	});

	it("fails when handlers keep recording events past the round limit", async () => {
		const registry = new InTransactionEventRegistry<OutboxTransaction>();
		const handler: InTransactionEventHandler<RewardPublished, TransactionalEventCollector> = {
			accepts(event: DomainEvent): event is RewardPublished {
				return event instanceof RewardPublished;
			},
			handle: (event: RewardPublished, events: TransactionalEventCollector): Promise<void> => {
				events.collect(new RewardPublished(event.occurredAt));
				return Promise.resolve();
			},
		};
		registry.register(bindInTransactionHandler(handler, { create: (_db, events) => events }));
		const collector = new TransactionalEventCollector();
		collector.collect(new RewardPublished(NOW));

		await expect(dispatcher([], registry, "none").drain(collector, DATABASE, ACTOR)).rejects.toBeInstanceOf(InTransactionEventLoopError);
	});
});
