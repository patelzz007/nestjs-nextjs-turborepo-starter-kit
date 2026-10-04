import { Logger } from "@nestjs/common";
import { QUEUE_JOB_OPTIONS } from "@workspace/shared";
import { SchedulerRegistry } from "@nestjs/schedule";
import type { Queue } from "bullmq";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { PrismaService } from "../../prisma/prisma.service";
import { currentRlsContext } from "../../prisma/rls-context";
import { isAllowlistedSystemOperation, SYSTEM_OPERATIONS } from "../../prisma/system-operation.registry";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { createTestTypedConfig } from "../../../test/support/test-api-env";
import { IdempotencyRecordRepository } from "./idempotency-record.repository";
import {
	IDEMPOTENCY_RETENTION_JOB_NAME,
	IDEMPOTENCY_RETENTION_QUEUE,
	IdempotencyRetentionProcessor,
	IdempotencyRetentionScheduler,
	type JobSchedulerRegistry,
} from "./idempotency-retention.processor";
import { IdempotencyRetentionIntervalScheduler } from "./idempotency-retention-interval.scheduler";
import { IDEMPOTENCY_PURGE_POLICY, IdempotencyRetentionService, type IdempotencyRetentionSummary } from "./idempotency-retention.service";
import {
	IDEMPOTENCY_IN_PROGRESS_LEASE_MS,
	IDEMPOTENCY_PURGE_BATCH_SIZE,
	IDEMPOTENCY_PURGE_GRACE_MS,
	IDEMPOTENCY_PURGE_INTERVAL_MS,
	IDEMPOTENCY_PURGE_SCHEDULER_ID,
	IDEMPOTENCY_PURGE_TIME_BUDGET_MS,
	IDEMPOTENCY_RETENTION_OPERATION,
} from "./idempotency.constants";
import { RequestContextService } from "../../common/context/request-context";

const START_EPOCH_MS = 1_790_812_800_000;
/** A Redis URL makes `useBullMq` true — nothing connects to it in these tests. */
const TEST_REDIS_URL = "redis://localhost:6379";

/** One recorded `deleteExpiredBefore` call. */
interface DeleteCall {
	readonly cutoffEpochMs: number;
	readonly batchSize: number;
}

/**
 * Repository double: an in-memory backlog of expiry timestamps with the same
 * "delete up to N rows expired before the cutoff" contract, plus a per-batch
 * latency so the time budget can be exercised with fake timers.
 */
class InMemoryRetentionRecords extends IdempotencyRecordRepository {
	public readonly calls: DeleteCall[] = [];
	public msPerBatch = 0;

	public constructor(public expiresAt: number[]) {
		super(new TenantTransactionService(new PrismaService(createTestTypedConfig()), new RequestContextService()));
	}

	public override deleteExpiredBefore(cutoffEpochMs: number, batchSize: number): Promise<number> {
		this.calls.push({ cutoffEpochMs, batchSize });
		vi.advanceTimersByTime(this.msPerBatch);
		const eligible: number[] = this.expiresAt.filter((expiry: number): boolean => expiry < cutoffEpochMs).slice(0, batchSize);
		this.expiresAt = this.expiresAt.filter((expiry: number): boolean => !eligible.includes(expiry));
		return Promise.resolve(eligible.length);
	}
}

/** `count` distinct expiry instants, all well past the grace period. */
function longExpired(count: number): number[] {
	return Array.from({ length: count }, (_value: number, index: number): number => START_EPOCH_MS - IDEMPOTENCY_PURGE_GRACE_MS - 1 - index);
}

describe("idempotency retention policy", () => {
	it("keeps a grace far longer than the in-progress lease so a live lease is never purged", () => {
		expect(IDEMPOTENCY_PURGE_GRACE_MS).toBeGreaterThan(IDEMPOTENCY_IN_PROGRESS_LEASE_MS);
	});

	it("bounds each run far below the schedule interval so runs cannot overlap", () => {
		expect(IDEMPOTENCY_PURGE_POLICY).toEqual({ batchSize: IDEMPOTENCY_PURGE_BATCH_SIZE, timeBudgetMs: IDEMPOTENCY_PURGE_TIME_BUDGET_MS });
		expect(IDEMPOTENCY_PURGE_TIME_BUDGET_MS).toBeLessThan(IDEMPOTENCY_PURGE_INTERVAL_MS);
	});

	it("runs under a registered, specific system operation", () => {
		expect(isAllowlistedSystemOperation(IDEMPOTENCY_RETENTION_OPERATION)).toBe(true);
		expect(SYSTEM_OPERATIONS[IDEMPOTENCY_RETENTION_OPERATION].role).toBe("app_runtime");
	});
});

describe("IdempotencyRetentionService", () => {
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

	it("deletes only rows expired longer than the grace period, keeping live and recently expired ones", async () => {
		const live = START_EPOCH_MS + IDEMPOTENCY_IN_PROGRESS_LEASE_MS;
		const recentlyExpired = START_EPOCH_MS - 1;
		const atCutoff = START_EPOCH_MS - IDEMPOTENCY_PURGE_GRACE_MS;
		const records = new InMemoryRetentionRecords([live, recentlyExpired, atCutoff, ...longExpired(2)]);

		const summary = await new IdempotencyRetentionService(records).purgeExpired();

		expect(summary).toMatchObject({ deleted: 2, batches: 1, stoppedBy: "drained", cutoffEpochMs: atCutoff });
		expect(records.expiresAt).toEqual([live, recentlyExpired, atCutoff]);
	});

	it("deletes in bounded batches with one fixed cutoff until the backlog is drained", async () => {
		const backlog = IDEMPOTENCY_PURGE_BATCH_SIZE * 2 + 7;
		const records = new InMemoryRetentionRecords(longExpired(backlog));

		const summary = await new IdempotencyRetentionService(records).purgeExpired();

		expect(summary).toMatchObject({ deleted: backlog, batches: 3, stoppedBy: "drained" });
		expect(records.calls).toEqual(
			Array.from({ length: 3 }, (): DeleteCall => ({ cutoffEpochMs: START_EPOCH_MS - IDEMPOTENCY_PURGE_GRACE_MS, batchSize: IDEMPOTENCY_PURGE_BATCH_SIZE })),
		);
		expect(records.expiresAt).toEqual([]);
	});

	it("stops at the time budget, leaves the rest for the next run, and warns", async () => {
		const records = new InMemoryRetentionRecords(longExpired(IDEMPOTENCY_PURGE_BATCH_SIZE * 10));
		// Each batch takes 40% of the budget: batches start at 0%, 40% and 80%.
		records.msPerBatch = (IDEMPOTENCY_PURGE_TIME_BUDGET_MS * 2) / 5;

		const summary = await new IdempotencyRetentionService(records).purgeExpired();

		expect(summary).toMatchObject({ deleted: IDEMPOTENCY_PURGE_BATCH_SIZE * 3, batches: 3, stoppedBy: "time_budget" });
		expect(records.expiresAt).toHaveLength(IDEMPOTENCY_PURGE_BATCH_SIZE * 7);
		expect(warn).toHaveBeenCalledWith(
			expect.objectContaining({ event: "idempotency.retention_summary", stoppedBy: "time_budget", deleted: IDEMPOTENCY_PURGE_BATCH_SIZE * 3 }),
		);
		expect(log).not.toHaveBeenCalled();
	});

	it("logs one structured summary per run, even when nothing was deleted", async () => {
		const records = new InMemoryRetentionRecords([]);

		const summary: IdempotencyRetentionSummary = await new IdempotencyRetentionService(records).purgeExpired();

		expect(log).toHaveBeenCalledTimes(1);
		expect(log).toHaveBeenCalledWith({ event: "idempotency.retention_summary", ...summary });
		expect(summary).toMatchObject({ deleted: 0, batches: 1, stoppedBy: "drained" });
		expect(warn).not.toHaveBeenCalled();
	});

	it("propagates a database failure so BullMQ retries the run", async () => {
		const records = new InMemoryRetentionRecords([]);
		vi.spyOn(records, "deleteExpiredBefore").mockRejectedValue(new Error("connection lost"));

		await expect(new IdempotencyRetentionService(records).purgeExpired()).rejects.toThrow("connection lost");
	});
});

describe("IdempotencyRetentionScheduler", () => {
	function schedulerWith(redisUrl: string | undefined): { scheduler: IdempotencyRetentionScheduler; upsert: ReturnType<typeof vi.fn<Queue["upsertJobScheduler"]>> } {
		const upsert = vi.fn<Queue["upsertJobScheduler"]>();
		const queue: JobSchedulerRegistry = { upsertJobScheduler: upsert };
		const config = createTestTypedConfig(redisUrl === undefined ? {} : { REDIS_URL: redisUrl });
		return { scheduler: new IdempotencyRetentionScheduler(config, queue), upsert };
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

		expect(IDEMPOTENCY_RETENTION_QUEUE).toBe("idempotency.retention");
		expect(upsert).toHaveBeenCalledTimes(1);
		expect(upsert).toHaveBeenCalledWith(
			IDEMPOTENCY_PURGE_SCHEDULER_ID,
			{ every: IDEMPOTENCY_PURGE_INTERVAL_MS },
			{ name: IDEMPOTENCY_RETENTION_JOB_NAME, data: {}, opts: QUEUE_JOB_OPTIONS.maintenance },
		);
	});

	it("registers nothing when BullMQ is disabled (the in-process interval scheduler runs retention instead)", async () => {
		const { scheduler, upsert } = schedulerWith(undefined);

		await scheduler.onModuleInit();

		expect(upsert).not.toHaveBeenCalled();
	});
});

describe("IdempotencyRetentionProcessor", () => {
	function processorWith(purge: () => Promise<IdempotencyRetentionSummary>): IdempotencyRetentionProcessor {
		const records = new InMemoryRetentionRecords([]);
		const retention = new IdempotencyRetentionService(records);
		vi.spyOn(retention, "purgeExpired").mockImplementation(purge);
		return new IdempotencyRetentionProcessor(retention);
	}

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("runs the purge inside the idempotency.retention system RLS scope and returns its summary", async () => {
		const summary: IdempotencyRetentionSummary = { deleted: 3, batches: 1, durationMs: 4, stoppedBy: "drained", cutoffEpochMs: START_EPOCH_MS };
		let operation: string | null = null;
		const processor = processorWith((): Promise<IdempotencyRetentionSummary> => {
			const context = currentRlsContext();
			operation = context.bypass ? context.systemOperation : null;
			return Promise.resolve(summary);
		});

		await expect(processor.process({ data: {} })).resolves.toEqual(summary);
		expect(operation).toBe(IDEMPOTENCY_RETENTION_OPERATION);
	});

	it("rejects an unexpected job payload before touching the database", async () => {
		const purge = vi.fn<() => Promise<IdempotencyRetentionSummary>>();
		const processor = processorWith(purge);

		await expect(processor.process({ data: { batchSize: 1_000_000 } })).rejects.toThrow();
		expect(purge).not.toHaveBeenCalled();
	});
});

describe("IdempotencyRetentionIntervalScheduler (no Redis)", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	function intervalSchedulerWith(purge: () => Promise<IdempotencyRetentionSummary>): { scheduler: IdempotencyRetentionIntervalScheduler; registry: SchedulerRegistry } {
		const retention = new IdempotencyRetentionService(new InMemoryRetentionRecords([]));
		vi.spyOn(retention, "purgeExpired").mockImplementation(purge);
		const registry = new SchedulerRegistry();
		return { scheduler: new IdempotencyRetentionIntervalScheduler(registry, retention), registry };
	}

	it("registers ONE in-process interval so retention runs even without Redis, and removes it on shutdown", () => {
		vi.spyOn(Logger.prototype, "log").mockImplementation((): void => undefined);
		const { scheduler, registry } = intervalSchedulerWith(() =>
			Promise.resolve({ deleted: 0, batches: 1, durationMs: 1, stoppedBy: "drained", cutoffEpochMs: START_EPOCH_MS }),
		);

		scheduler.onModuleInit();
		expect(registry.doesExist("interval", IDEMPOTENCY_PURGE_SCHEDULER_ID)).toBe(true);

		scheduler.onApplicationShutdown();
		expect(registry.doesExist("interval", IDEMPOTENCY_PURGE_SCHEDULER_ID)).toBe(false);
	});

	it("fires a purge every interval inside the idempotency.retention system scope", async () => {
		vi.useFakeTimers();
		vi.spyOn(Logger.prototype, "log").mockImplementation((): void => undefined);
		const operations: (string | null)[] = [];
		const { scheduler } = intervalSchedulerWith((): Promise<IdempotencyRetentionSummary> => {
			operations.push(currentRlsContext().systemOperation);
			return Promise.resolve({ deleted: 0, batches: 1, durationMs: 1, stoppedBy: "drained", cutoffEpochMs: START_EPOCH_MS });
		});

		scheduler.onModuleInit();
		await vi.advanceTimersByTimeAsync(IDEMPOTENCY_PURGE_INTERVAL_MS * 2);
		scheduler.onApplicationShutdown();

		expect(operations).toEqual([IDEMPOTENCY_RETENTION_OPERATION, IDEMPOTENCY_RETENTION_OPERATION]);
	});

	it("logs a failed run at error and keeps the schedule alive", async () => {
		const error = vi.spyOn(Logger.prototype, "error").mockImplementation((): void => undefined);
		const { scheduler } = intervalSchedulerWith(() => Promise.reject(new Error("connection lost")));

		await expect(scheduler.runOnce()).resolves.toBeNull();
		expect(error).toHaveBeenCalledWith({ event: "idempotency.retention_failed", error: "connection lost" });
	});
});
