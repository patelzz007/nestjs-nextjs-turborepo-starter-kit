import { Logger } from "@nestjs/common";
import { QUEUE_JOB_OPTIONS, QUEUE_NAMES } from "@workspace/shared";
import type { Queue } from "bullmq";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { PrismaService } from "../../prisma/prisma.service";
import { currentRlsContext } from "../../prisma/rls-context";
import { isAllowlistedSystemOperation, SYSTEM_OPERATIONS } from "../../prisma/system-operation.registry";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { createTestTypedConfig } from "../../../test/support/test-api-env";
import {
	OUTBOX_DEAD_LETTER_RETENTION_MS,
	OUTBOX_PUBLISHED_RETENTION_MS,
	OUTBOX_PURGE_BATCH_SIZE,
	OUTBOX_PURGE_INTERVAL_MS,
	OUTBOX_PURGE_TIME_BUDGET_MS,
	OUTBOX_RETENTION_JOB_NAME,
	OUTBOX_RETENTION_OPERATION,
	OUTBOX_RETENTION_QUEUE,
	OUTBOX_RETENTION_SCHEDULER_ID,
} from "./outbox-retention.constants";
import { OutboxRetentionProcessor, OutboxRetentionScheduler, type OutboxRetentionSchedulerRegistry } from "./outbox-retention.processor";
import { OutboxRetentionRepository, type SettledOutboxStatus } from "./outbox-retention.repository";
import { OUTBOX_PURGE_POLICY, OutboxRetentionService, type OutboxRetentionSummary } from "./outbox-retention.service";
import { RequestContextService } from "../../common/context/request-context";

const START_EPOCH_MS = 1_790_812_800_000;
/** A Redis URL makes `useBullMq` true — nothing connects to it in these tests. */
const TEST_REDIS_URL = "redis://localhost:6379";

/** One in-memory outbox row: its state and the instant it settled (published / dead-lettered / still pending). */
interface MemoryOutboxRow {
	readonly status: SettledOutboxStatus | "PENDING";
	readonly settledAt: number;
}

/** One recorded `deleteSettledBefore` call. */
interface DeleteCall {
	readonly status: SettledOutboxStatus;
	readonly cutoffEpochMs: number;
	readonly batchSize: number;
}

/** Repository double with the same "delete up to N rows of `status` settled before the cutoff" contract. */
class InMemoryOutboxRows extends OutboxRetentionRepository {
	public readonly calls: DeleteCall[] = [];
	public msPerBatch = 0;

	public constructor(public rows: MemoryOutboxRow[]) {
		super(new TenantTransactionService(new PrismaService(createTestTypedConfig()), new RequestContextService()));
	}

	public override deleteSettledBefore(status: SettledOutboxStatus, cutoffEpochMs: number, batchSize: number): Promise<number> {
		this.calls.push({ status, cutoffEpochMs, batchSize });
		vi.advanceTimersByTime(this.msPerBatch);
		const eligible: MemoryOutboxRow[] = this.rows.filter((row: MemoryOutboxRow): boolean => row.status === status && row.settledAt < cutoffEpochMs).slice(0, batchSize);
		this.rows = this.rows.filter((row: MemoryOutboxRow): boolean => !eligible.includes(row));
		return Promise.resolve(eligible.length);
	}
}

function rowsSettled(status: SettledOutboxStatus | "PENDING", count: number, settledAt: number): MemoryOutboxRow[] {
	return Array.from({ length: count }, (): MemoryOutboxRow => ({ status, settledAt }));
}

describe("outbox retention policy", () => {
	it("keeps dead letters longer than published rows (they still need an operator decision)", () => {
		expect(OUTBOX_DEAD_LETTER_RETENTION_MS).toBeGreaterThan(OUTBOX_PUBLISHED_RETENTION_MS);
	});

	it("bounds each run far below the schedule interval so runs cannot overlap", () => {
		expect(OUTBOX_PURGE_POLICY).toEqual({ batchSize: OUTBOX_PURGE_BATCH_SIZE, timeBudgetMs: OUTBOX_PURGE_TIME_BUDGET_MS });
		expect(OUTBOX_PURGE_TIME_BUDGET_MS * 2).toBeLessThan(OUTBOX_PURGE_INTERVAL_MS);
	});

	it("runs under a registered, specific system operation", () => {
		expect(isAllowlistedSystemOperation(OUTBOX_RETENTION_OPERATION)).toBe(true);
		expect(SYSTEM_OPERATIONS[OUTBOX_RETENTION_OPERATION].role).toBe("app_runtime");
	});
});

describe("OutboxRetentionService", () => {
	let log: MockInstance<Logger["log"]>;
	let warn: MockInstance<Logger["warn"]>;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(START_EPOCH_MS);
		log = vi.spyOn(Logger.prototype, "log").mockImplementation((): void => undefined);
		warn = vi.spyOn(Logger.prototype, "warn").mockImplementation((): void => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it("deletes only settled rows past their status' window and never a PENDING row", async () => {
		const publishedCutoff = START_EPOCH_MS - OUTBOX_PUBLISHED_RETENTION_MS;
		const deadLetterCutoff = START_EPOCH_MS - OUTBOX_DEAD_LETTER_RETENTION_MS;
		const kept: MemoryOutboxRow[] = [
			...rowsSettled("PENDING", 2, deadLetterCutoff - 1),
			...rowsSettled("PUBLISHED", 1, publishedCutoff),
			...rowsSettled("FAILED", 1, publishedCutoff - 1),
		];
		const rows = new InMemoryOutboxRows([...kept, ...rowsSettled("PUBLISHED", 3, publishedCutoff - 1), ...rowsSettled("FAILED", 2, deadLetterCutoff - 1)]);

		const summary = await new OutboxRetentionService(rows).purgeSettled();

		expect(summary.published).toMatchObject({ deleted: 3, stoppedBy: "drained", cutoffEpochMs: publishedCutoff });
		expect(summary.deadLettered).toMatchObject({ deleted: 2, stoppedBy: "drained", cutoffEpochMs: deadLetterCutoff });
		expect(rows.rows).toEqual(kept);
	});

	it("deletes in bounded batches with one fixed cutoff until the backlog is drained", async () => {
		const backlog = OUTBOX_PURGE_BATCH_SIZE * 2 + 7;
		const rows = new InMemoryOutboxRows(rowsSettled("PUBLISHED", backlog, 0));

		const summary = await new OutboxRetentionService(rows).purgeSettled();

		expect(summary.published).toMatchObject({ deleted: backlog, batches: 3, stoppedBy: "drained" });
		expect(rows.calls.filter((call: DeleteCall): boolean => call.status === "PUBLISHED")).toEqual(
			Array.from({ length: 3 }, (): DeleteCall => ({
				status: "PUBLISHED",
				cutoffEpochMs: START_EPOCH_MS - OUTBOX_PUBLISHED_RETENTION_MS,
				batchSize: OUTBOX_PURGE_BATCH_SIZE,
			})),
		);
	});

	it("stops at the time budget, leaves the rest for the next run, and warns", async () => {
		const rows = new InMemoryOutboxRows(rowsSettled("PUBLISHED", OUTBOX_PURGE_BATCH_SIZE * 10, 0));
		// Each batch takes 40% of the budget: batches start at 0%, 40% and 80%.
		rows.msPerBatch = (OUTBOX_PURGE_TIME_BUDGET_MS * 2) / 5;

		const summary = await new OutboxRetentionService(rows).purgeSettled();

		expect(summary.published).toMatchObject({ deleted: OUTBOX_PURGE_BATCH_SIZE * 3, stoppedBy: "time_budget" });
		expect(warn).toHaveBeenCalledWith(expect.objectContaining({ event: "outbox.retention_summary" }));
		expect(log).not.toHaveBeenCalled();
	});

	it("warns when it purges a dead letter nobody replayed", async () => {
		const rows = new InMemoryOutboxRows(rowsSettled("FAILED", 1, 0));

		await new OutboxRetentionService(rows).purgeSettled();

		expect(warn).toHaveBeenCalledTimes(1);
		expect(log).not.toHaveBeenCalled();
	});

	it("logs one structured summary per run, even when nothing was deleted", async () => {
		const summary: OutboxRetentionSummary = await new OutboxRetentionService(new InMemoryOutboxRows([])).purgeSettled();

		expect(log).toHaveBeenCalledTimes(1);
		expect(log).toHaveBeenCalledWith({ event: "outbox.retention_summary", ...summary });
		expect(warn).not.toHaveBeenCalled();
	});

	it("propagates a database failure so BullMQ retries the run", async () => {
		const rows = new InMemoryOutboxRows([]);
		vi.spyOn(rows, "deleteSettledBefore").mockRejectedValue(new Error("connection lost"));

		await expect(new OutboxRetentionService(rows).purgeSettled()).rejects.toThrow("connection lost");
	});
});

describe("OutboxRetentionScheduler", () => {
	function schedulerWith(redisUrl: string | undefined): { scheduler: OutboxRetentionScheduler; upsert: ReturnType<typeof vi.fn<Queue["upsertJobScheduler"]>> } {
		const upsert = vi.fn<Queue["upsertJobScheduler"]>();
		const queue: OutboxRetentionSchedulerRegistry = { upsertJobScheduler: upsert };
		const config = createTestTypedConfig(redisUrl === undefined ? {} : { REDIS_URL: redisUrl });
		return { scheduler: new OutboxRetentionScheduler(config, queue), upsert };
	}

	beforeEach(() => {
		vi.spyOn(Logger.prototype, "log").mockImplementation((): void => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("upserts ONE hourly scheduler under a fixed id, with the maintenance retry preset", async () => {
		const { scheduler, upsert } = schedulerWith(TEST_REDIS_URL);

		await scheduler.onModuleInit();

		expect(OUTBOX_RETENTION_QUEUE).toBe(QUEUE_NAMES.outboxRetention);
		expect(upsert).toHaveBeenCalledTimes(1);
		expect(upsert).toHaveBeenCalledWith(
			OUTBOX_RETENTION_SCHEDULER_ID,
			{ every: OUTBOX_PURGE_INTERVAL_MS },
			{ name: OUTBOX_RETENTION_JOB_NAME, data: {}, opts: QUEUE_JOB_OPTIONS.maintenance },
		);
	});

	it("registers nothing without Redis (BullMQ disabled), like every other scheduler", async () => {
		const { scheduler, upsert } = schedulerWith(undefined);

		await scheduler.onModuleInit();

		expect(upsert).not.toHaveBeenCalled();
	});
});

describe("OutboxRetentionProcessor", () => {
	function processorWith(purge: () => Promise<OutboxRetentionSummary>): OutboxRetentionProcessor {
		const retention = new OutboxRetentionService(new InMemoryOutboxRows([]));
		vi.spyOn(retention, "purgeSettled").mockImplementation(purge);
		const scheduler = new OutboxRetentionScheduler(createTestTypedConfig(), { upsertJobScheduler: vi.fn<Queue["upsertJobScheduler"]>() });
		return new OutboxRetentionProcessor(scheduler, retention);
	}

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("runs the purge inside the outbox.retention system RLS scope and returns its summary", async () => {
		const empty = { deleted: 0, batches: 1, durationMs: 0, stoppedBy: "drained", cutoffEpochMs: START_EPOCH_MS } satisfies OutboxRetentionSummary["published"];
		const summary: OutboxRetentionSummary = { published: empty, deadLettered: empty };
		let operation: string | null = null;
		const processor = processorWith((): Promise<OutboxRetentionSummary> => {
			const context = currentRlsContext();
			operation = context.bypass ? context.systemOperation : null;
			return Promise.resolve(summary);
		});

		await expect(processor.process({ data: {} })).resolves.toEqual(summary);
		expect(operation).toBe(OUTBOX_RETENTION_OPERATION);
	});

	it("rejects an unexpected job payload before touching the database", async () => {
		const purge = vi.fn<() => Promise<OutboxRetentionSummary>>();
		const processor = processorWith(purge);

		await expect(processor.process({ data: { batchSize: 1_000_000 } })).rejects.toThrow();
		expect(purge).not.toHaveBeenCalled();
	});
});
