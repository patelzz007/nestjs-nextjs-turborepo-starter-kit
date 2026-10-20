import { epochMs, type EpochMs, type PlatformEventId, type PlatformEventInput } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { systemActor } from "../../../application/actor-context";
import { InTransactionEventRegistry } from "../../../application/events/in-transaction-event-registry";
import { IntegrationEventMapperRegistry } from "../../../application/events/integration-event-mapper";
import type { TransactionalEventCollector } from "../../../application/events/transactional-event-collector";
import { DomainEvent } from "../../../domain/domain-event";
import type { OutboxTransaction } from "../../outbox/platform-outbox.service";
import type { AfterCommitPublisher } from "../after-commit-publisher";
import type { RlsTransactionScope } from "../actor-to-rls-context";
import { PrismaUnitOfWork, type RlsTransactionRunner } from "../prisma-unit-of-work";
import { TransactionalEventDispatcher, type TransactionalOutboxWriter } from "../transactional-event-dispatcher";
import { systemRlsContext } from "../../../../prisma/rls-context";

const NOW: EpochMs = epochMs(1_792_195_200_000);
const PROBE_EVENT_ID: PlatformEventId = "8d0f3b0e-1f7a-4c55-9d1e-2f1a6b7c8d90";
const PROBE_RECORD: PlatformEventInput = {
	type: "session.action",
	payload: { action: "logout-all", userId: PROBE_EVENT_ID, status: "succeeded", error: null, durationMs: 3 },
};

class ProbeEvent extends DomainEvent {
	public readonly eventName = "platform.ProbeRecorded";

	public constructor(occurredAt: EpochMs) {
		super(occurredAt);
	}
}

class CommitFailed extends Error {}

const DATABASE: OutboxTransaction = {
	outboxEvent: {
		createMany: (): Promise<{ readonly count: number }> => Promise.resolve({ count: 1 }),
	},
};

/**
 * A transaction runner that writes every phase into ONE shared trace: `begin`,
 * the handler, then `commit` — or a commit failure after the handler resolved,
 * like a serialization failure Postgres reports at COMMIT.
 */
class TracingRunner implements RlsTransactionRunner<OutboxTransaction> {
	public readonly scopes: RlsTransactionScope[] = [];

	public constructor(
		private readonly trace: string[],
		private readonly commitFails = false,
	) {}

	public async withRlsContext<TResult>(scope: RlsTransactionScope, handler: (db: OutboxTransaction) => Promise<TResult>): Promise<TResult> {
		this.scopes.push(scope);
		this.trace.push("begin");
		const result: TResult = await handler(DATABASE);
		if (this.commitFails) {
			this.trace.push("commit-failed");
			throw new CommitFailed("could not serialize access");
		}
		this.trace.push("commit");
		return result;
	}
}

class TracingPublisher implements AfterCommitPublisher {
	public constructor(private readonly trace: string[]) {}

	public publish(event: DomainEvent): Promise<void> {
		this.trace.push(`publish:${event.eventName}`);
		return Promise.resolve();
	}
}

class TracingOutbox implements TransactionalOutboxWriter {
	public constructor(private readonly trace: string[]) {}

	public enqueueInTransaction(): Promise<PlatformEventId> {
		this.trace.push("outbox");
		return Promise.resolve(PROBE_EVENT_ID);
	}
}

function unitOfWork(trace: string[], runner: TracingRunner): PrismaUnitOfWork<TransactionalEventCollector, OutboxTransaction> {
	const mappers = new IntegrationEventMapperRegistry();
	mappers.register({ map: (event: DomainEvent): PlatformEventInput | null => (event instanceof ProbeEvent ? PROBE_RECORD : null) });
	return new PrismaUnitOfWork(
		runner,
		{ create: (_db, events) => events },
		new TransactionalEventDispatcher(new InTransactionEventRegistry<OutboxTransaction>(), mappers, new TracingOutbox(trace)),
		new TracingPublisher(trace),
	);
}

const ACTOR = systemActor("outbox.enqueue", "job", null, "Probe", null);

describe("PrismaUnitOfWork", () => {
	it("writes the outbox row inside the transaction and publishes only after commit", async () => {
		const trace: string[] = [];

		const result = await unitOfWork(trace, new TracingRunner(trace)).run(ACTOR, (events): Promise<string> => {
			trace.push("work");
			events.collect(new ProbeEvent(NOW));
			return Promise.resolve("saved");
		});

		expect(result).toBe("saved");
		expect(trace).toEqual(["begin", "work", "outbox", "commit", "publish:platform.ProbeRecorded"]);
	});

	it("publishes nothing when the work throws (rollback)", async () => {
		const trace: string[] = [];

		await expect(
			unitOfWork(trace, new TracingRunner(trace)).run(ACTOR, (events): Promise<string> => {
				events.collect(new ProbeEvent(NOW));
				return Promise.reject(new Error("rolled back"));
			}),
		).rejects.toThrow("rolled back");

		expect(trace).toEqual(["begin"]);
	});

	it("publishes nothing when the commit itself fails after the work and the outbox write succeeded", async () => {
		const trace: string[] = [];

		await expect(
			unitOfWork(trace, new TracingRunner(trace, true)).run(ACTOR, (events): Promise<string> => {
				trace.push("work");
				events.collect(new ProbeEvent(NOW));
				return Promise.resolve("saved");
			}),
		).rejects.toBeInstanceOf(CommitFailed);

		expect(trace).toEqual(["begin", "work", "outbox", "commit-failed"]);
	});

	it("runs a system operation under that operation's bypass scope, with the system actor's reason and acting user", async () => {
		const trace: string[] = [];
		const runner = new TracingRunner(trace);
		const actor = systemActor("outbox.enqueue", "job", "org-1", "Re-publish rewards", "user-1");

		await unitOfWork(trace, runner).runSystemOperation("outbox.enqueue", actor, (): Promise<string> => Promise.resolve("ok"));

		expect(runner.scopes).toEqual([{ context: systemRlsContext("outbox.enqueue", "user-1", "org-1"), reason: "Re-publish rewards" }]);
	});
});
