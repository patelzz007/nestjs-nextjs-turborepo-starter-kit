import { NOTIFICATION_EMAIL_OUTBOX_TOPIC, NOTIFICATION_EMAIL_REQUESTED_EVENT_TYPE, type JsonValue, type NotificationEmailRequestedPayload } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { OUTBOX_RETRY_POLICY, type ClaimedOutboxRow, type OutboxClock, type OutboxLogEntry, type OutboxLogSink } from "../outbox-dispatcher";
import { OutboxEmailRelay, OutboxEmailRouteRegistry, type OutboxEmailRelayStore, type OutboxEmailRequestTarget } from "../outbox-email-relay";

const NOW_MS = 1_790_812_800_000;
const EMAIL_LOG_ID = "6b1f3e2a-9c4d-4e5f-8a7b-1c2d3e4f5a6b";
const NO_JITTER = (): number => 0.5;

type RowStatus = "PENDING" | "PUBLISHED" | "FAILED";

interface StoredRow {
	readonly id: string;
	readonly topic: string;
	readonly payload: JsonValue;
	status: RowStatus;
	attempts: number;
	availableAt: number;
	leased: boolean;
}

function emailPayload(emailLogId: string = EMAIL_LOG_ID): JsonValue {
	return {
		type: NOTIFICATION_EMAIL_REQUESTED_EVENT_TYPE,
		correlationId: null,
		occurredAt: NOW_MS,
		payload: { emailLogId, templateKey: "welcome", props: { to: "a@example.com", name: "A" } },
	};
}

/** The relay's row store in memory, with lease semantics: a claimed row is invisible until released or settled. */
class InMemoryEmailRows implements OutboxEmailRelayStore {
	public readonly rows: StoredRow[] = [];

	public add(id: string, payload: JsonValue = emailPayload(), topic: string = NOTIFICATION_EMAIL_OUTBOX_TOPIC): void {
		this.rows.push({ id, topic, payload, status: "PENDING", attempts: 0, availableAt: 0, leased: false });
	}

	public claimDue(limit: number, nowMs: number): Promise<readonly ClaimedOutboxRow[]> {
		const due = this.rows.filter((row) => row.status === "PENDING" && !row.leased && row.availableAt <= nowMs).slice(0, limit);
		for (const row of due) {
			row.leased = true;
		}
		return Promise.resolve(due.map((row) => this.claimed(row)));
	}

	public claimById(id: string, nowMs: number): Promise<ClaimedOutboxRow | null> {
		const row = this.rows.find((candidate) => candidate.id === id && candidate.status === "PENDING" && !candidate.leased && candidate.availableAt <= nowMs);
		if (row === undefined) {
			return Promise.resolve(null);
		}
		row.leased = true;
		return Promise.resolve(this.claimed(row));
	}

	public markPublished(id: string): Promise<void> {
		this.update(id, (row) => {
			row.status = "PUBLISHED";
		});
		return Promise.resolve();
	}

	public scheduleRetry(id: string, attempts: number, _error: string, availableAtMs: number): Promise<void> {
		this.update(id, (row) => {
			row.attempts = attempts;
			row.availableAt = availableAtMs;
		});
		return Promise.resolve();
	}

	public release(ids: readonly string[], availableAtMs: number): Promise<void> {
		for (const id of ids) {
			this.update(id, (row) => {
				row.availableAt = availableAtMs;
			});
		}
		return Promise.resolve();
	}

	public markDeadLettered(id: string, attempts: number): Promise<void> {
		this.update(id, (row) => {
			row.status = "FAILED";
			row.attempts = attempts;
		});
		return Promise.resolve();
	}

	public status(id: string): RowStatus | undefined {
		return this.rows.find((row) => row.id === id)?.status;
	}

	private claimed(row: StoredRow): ClaimedOutboxRow {
		return { id: row.id, topic: row.topic, partitionKey: null, attempts: row.attempts, payload: row.payload };
	}

	private update(id: string, change: (row: StoredRow) => void): void {
		const row = this.rows.find((candidate) => candidate.id === id);
		if (row !== undefined) {
			change(row);
			row.leased = false;
		}
	}
}

/** The email queue: records hand-offs, deduplicating by email log id as BullMQ dedupes the job id; can be down. */
class RecordingQueueTarget implements OutboxEmailRequestTarget {
	public readonly jobIds: string[] = [];
	public down = false;

	public handOff(request: NotificationEmailRequestedPayload): Promise<void> {
		if (this.down) {
			return Promise.reject(new Error("Redis unavailable"));
		}
		if (!this.jobIds.includes(request.emailLogId)) {
			this.jobIds.push(request.emailLogId);
		}
		return Promise.resolve();
	}
}

/** Collects structured log lines. */
class LogSink implements OutboxLogSink {
	public readonly entries: OutboxLogEntry[] = [];

	public log(entry: OutboxLogEntry): void {
		this.entries.push(entry);
	}

	public warn(entry: OutboxLogEntry): void {
		this.entries.push(entry);
	}

	public error(entry: OutboxLogEntry): void {
		this.entries.push(entry);
	}
}

const CLOCK: OutboxClock = { nowEpochMs: (): number => NOW_MS };

function setup(target: RecordingQueueTarget | null = new RecordingQueueTarget()): { relay: OutboxEmailRelay; rows: InMemoryEmailRows; target: RecordingQueueTarget | null } {
	const rows = new InMemoryEmailRows();
	const routes = new OutboxEmailRouteRegistry();
	if (target !== null) {
		routes.register(target);
	}
	return { relay: new OutboxEmailRelay(rows, routes, CLOCK, new LogSink(), OUTBOX_RETRY_POLICY, undefined, NO_JITTER), rows, target };
}

describe("OutboxEmailRelay", () => {
	it("hands every due email request to the queue (jobId = email log id) and marks it published", async () => {
		const { relay, rows, target } = setup();
		rows.add("row-1");

		await expect(relay.relayDue()).resolves.toMatchObject({ claimed: 1, handedOff: 1 });
		expect(target?.jobIds).toEqual([EMAIL_LOG_ID]);
		expect(rows.status("row-1")).toBe("PUBLISHED");
	});

	it("does nothing without a registered target (notifications not loaded)", async () => {
		const { relay, rows } = setup(null);
		rows.add("row-1");

		await expect(relay.relayDue()).resolves.toBeNull();
		await expect(relay.relayOne("row-1")).resolves.toBe("no_target");
		expect(rows.status("row-1")).toBe("PENDING");
	});

	it("is idempotent: the after-commit nudge and the sweep never hand the same row off twice", async () => {
		const { relay, rows, target } = setup();
		rows.add("row-1");

		await expect(relay.relayOne("row-1")).resolves.toBe("handed_off");
		await expect(relay.relayOne("row-1")).resolves.toBe("not_claimed");
		await expect(relay.relayDue()).resolves.toMatchObject({ claimed: 0 });
		expect(target?.jobIds).toEqual([EMAIL_LOG_ID]);
	});

	it("dead-letters a malformed row or one on another topic at once", async () => {
		const { relay, rows } = setup();
		rows.add("bad-payload", { type: NOTIFICATION_EMAIL_REQUESTED_EVENT_TYPE });
		rows.add("wrong-topic", emailPayload(), "platform.email");

		await expect(relay.relayDue()).resolves.toMatchObject({ claimed: 2, deadLettered: 2 });
		expect(rows.status("bad-payload")).toBe("FAILED");
		expect(rows.status("wrong-topic")).toBe("FAILED");
	});

	it("spends an attempt with backoff when the queue is down, releases the rest of the batch, and dead-letters at max attempts", async () => {
		const target = new RecordingQueueTarget();
		target.down = true;
		const { relay, rows } = setup(target);
		rows.add("row-1");
		rows.add("row-2", emailPayload("7c9e6679-7425-40de-944b-e07fc1f90ae7"));

		await expect(relay.relayDue()).resolves.toMatchObject({ claimed: 2, retried: 1, released: 1 });
		const [first] = rows.rows;
		expect(first).toMatchObject({ status: "PENDING", attempts: 1 });
		expect(first?.availableAt).toBeGreaterThan(NOW_MS);

		if (first !== undefined) {
			first.attempts = OUTBOX_RETRY_POLICY.maxAttempts - 1;
			first.availableAt = 0;
		}
		await relay.relayOne("row-1");
		expect(rows.status("row-1")).toBe("FAILED");
	});
});
