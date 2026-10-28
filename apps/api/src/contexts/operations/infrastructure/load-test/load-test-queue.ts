// ============================================
// infrastructure/load-test/load-test-queue.ts — the load runner's queue, and its events
// ============================================
// The API never runs a load test itself: it adds a job to `operations.load-test`, which the separate
// load runner (apps/load-runner) takes. The runner reports back through BullMQ's own events —
// `active`, `progress` (each second) and `completed` / `failed` — which `LoadTestEventsListener`
// turns into `LoadTestRecorder` calls on every API instance (the recorder is idempotent).

import { randomBytes } from "node:crypto";

import { Logger, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import { LoadTestOutcomeSchema, LoadTestProgressSchema, QUEUE_JOB_OPTIONS, QUEUE_NAMES, type LoadTestJob } from "@workspace/shared";
import { createBullMqConnection } from "@workspace/messaging";
import * as bcrypt from "bcrypt";
import { QueueEvents, type Queue } from "bullmq";

import type { LoadTestPasswordPort, LoadTestQueuePort } from "../../application/ports/load-test.ports";
import type { LoadTestRecorder } from "../../application/services/load-test-recorder";

/** The job name on the `operations.load-test` queue. */
export const LOAD_TEST_JOB_NAME = "run-load-test";

export class BullLoadTestQueue implements LoadTestQueuePort {
	public readonly available = true;

	public constructor(private readonly queue: Pick<Queue<LoadTestJob>, "add" | "getJob">) {}

	/** `jobId` = run id: one job per run. Never retried (`operationsLoadTest`: one attempt). */
	public async enqueue(job: LoadTestJob): Promise<void> {
		await this.queue.add(LOAD_TEST_JOB_NAME, job, { ...QUEUE_JOB_OPTIONS.operationsLoadTest, jobId: job.runId });
	}

	public async removeWaiting(runId: string): Promise<boolean> {
		const job = await this.queue.getJob(runId);
		if (job === undefined || !(await job.isWaiting())) {
			return false;
		}
		await job.remove();
		return true;
	}
}

/** Without Redis there is no runner to hand a run to. */
export class UnavailableLoadTestQueue implements LoadTestQueuePort {
	public readonly available = false;

	public enqueue(): Promise<void> {
		return Promise.reject(new Error("Load tests need Redis (REDIS_URL) for the load runner's queue"));
	}

	public removeWaiting(): Promise<boolean> {
		return Promise.resolve(false);
	}
}

/** A fresh random password per run (never stored in clear), and its bcrypt hash for every load-test user. */
export class RandomLoadTestPasswords implements LoadTestPasswordPort {
	public constructor(private readonly saltRounds: number) {}

	public async issue(): Promise<{ readonly password: string; readonly hash: string }> {
		const passwordBytes = 24;
		const password = `Lt1!${randomBytes(passwordBytes).toString("base64url")}`;
		return { password, hash: await bcrypt.hash(password, this.saltRounds) };
	}
}

/** Listens to the runner's events and records them (ADAPTER from BullMQ events to the recorder). */
export class LoadTestEventsListener implements OnModuleInit, OnApplicationShutdown {
	private readonly logger: Logger = new Logger(LoadTestEventsListener.name);
	private events: QueueEvents | null = null;

	public constructor(
		private readonly recorder: LoadTestRecorder,
		private readonly redisUrl: string,
		private readonly prefix: string,
	) {}

	public onModuleInit(): void {
		const events = new QueueEvents(QUEUE_NAMES.operationsLoadTest, { connection: createBullMqConnection(this.redisUrl), prefix: this.prefix });
		events.on("active", ({ jobId }): void => {
			this.handle(jobId, () => this.recorder.started(jobId));
		});
		events.on("progress", ({ jobId, data }): void => {
			const progress = LoadTestProgressSchema.safeParse(data);
			if (progress.success) {
				this.handle(jobId, () => this.recorder.progress(jobId, progress.data));
			}
		});
		events.on("completed", ({ jobId, returnvalue }): void => {
			const outcome = LoadTestOutcomeSchema.safeParse(returnvalue);
			this.handle(jobId, () =>
				outcome.success ? this.recorder.finished(jobId, outcome.data) : this.recorder.failed(jobId, "The load runner returned an outcome this API does not understand"),
			);
		});
		events.on("failed", ({ jobId, failedReason }): void => {
			this.handle(jobId, () => this.recorder.failed(jobId, failedReason));
		});
		this.events = events;
	}

	public async onApplicationShutdown(): Promise<void> {
		await this.events?.close();
	}

	/** Records one event; a failure is logged (the next event, or the outcome, records the run again). */
	private handle(runId: string, work: () => Promise<void>): void {
		work().catch((error: unknown): void => {
			this.logger.error({ event: "load_test.record_failed", runId, error: error instanceof Error ? error.message : String(error) });
		});
	}
}
