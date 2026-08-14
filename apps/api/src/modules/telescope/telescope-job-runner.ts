import { Inject, Injectable } from "@nestjs/common";
import { nanoid } from "nanoid";

import { nowEpochMs, type EpochMs, type TelescopeJobLogEntry } from "@workspace/shared";

import { TelescopeEventBus } from "./telescope-event-bus.js";
import { RequestSpanContext } from "./request-span-context.js";
import { TELESCOPE_STORE } from "./telescope.options.js";
import type { TelescopeStore } from "./telescope.store.js";

/**
 * Feature 3 — queue/job inspection.
 *
 * The seam for recording ANY async unit of work into Telescope, queue-agnostic
 * by design: wrap a task with `TelescopeJobRunner.run("job-name", fn)` and the
 * runner records a `TelescopeJobLogEntry` (enqueued/started/finished timestamps,
 * duration, payload size, error) plus a `queue`-kind span on the current
 * request when the job runs inside a captured request's async context.
 *
 * Integration with a real queue (BullMQ, etc.) is a thin adapter: call
 * `run()` from the worker's `process` callback — the job payload size and
 * correlation id come along for free.
 */
@Injectable()
export class TelescopeJobRunner {
	private readonly runnables = new Map<string, () => Promise<void>>();

	public constructor(
		@Inject(TELESCOPE_STORE) private readonly store: TelescopeStore,
		private readonly eventBus: TelescopeEventBus,
	) {}

	/**
	 * Runs `fn` and records the job. The result is the task's own return value
	 * (jobs are the caller's work — Telescope only watches). When the job is
	 * enqueued inside a captured request, `correlationId` links it back to the
	 * request and a `queue` span is added to that request's timeline.
	 *
	 * Improvement 17 — the fn is registered under `jobName` so a failed job
	 * can be re-run from the UI (`POST /telescope/jobs/:id/retry`). Re-running
	 * creates a NEW job entry; the original entry keeps its history.
	 */
	public async run<T>(jobName: string, fn: () => Promise<T>, payload?: TelescopeJsonValueForJob): Promise<T> {
		// Register the runnable (last writer wins — the same jobName re-running
		// with a different fn is fine; the retry uses whatever is current).
		this.runnables.set(jobName, async (): Promise<void> => {
			await fn();
		});
		const correlationId: string | null = RequestSpanContext.getStore()?.correlationId ?? null;
		const enqueuedAt: EpochMs = nowEpochMs();
		const payloadSize: number = payload === undefined ? 0 : Buffer.byteLength(JSON.stringify(payload), "utf8");

		const entry: TelescopeJobLogEntry = {
			id: nanoid(),
			jobName,
			status: "running",
			durationMs: null,
			payloadSize,
			error: null,
			correlationId,
			enqueuedAt,
			startedAt: null,
			finishedAt: null,
		};
		this.store.pushJob(entry);

		const startedAt: EpochMs = nowEpochMs();
		entry.startedAt = startedAt;
		const start: number = performance.now();

		try {
			const result: T = await RequestSpanContext.span(`job: ${jobName}`, "queue", fn);
			entry.status = "succeeded";
			entry.durationMs = Math.round(performance.now() - start);
			entry.finishedAt = nowEpochMs();
			return result;
		} catch (error) {
			entry.status = "failed";
			entry.durationMs = Math.round(performance.now() - start);
			entry.finishedAt = nowEpochMs();
			entry.error = error instanceof Error ? error.message : String(error);
			throw error;
		} finally {
			this.store.pushJob(entry);
			// Publish a `job` frame so the /telescope/jobs page refetches on push
			// instead of polling. Only the terminal status is emitted — the
			// "running" snapshot is already persisted, and re-emitting it would
			// double the refetches for long-running jobs.
			this.eventBus.publish({
				type: "job",
				id: entry.id,
				jobName: entry.jobName,
				jobStatus: entry.status,
				durationMs: entry.durationMs ?? undefined,
				// Lets the feed navigate straight to the request the job ran inside.
				correlationId: entry.correlationId,
			});
		}
	}

	/** Improvement 17 — re-run a failed job by id, producing a NEW job entry. */
	public async retry(id: string): Promise<TelescopeJobLogEntry | null> {
		const original: TelescopeJobLogEntry | undefined = this.store.getJob(id);
		if (original === undefined) {
			return null;
		}
		const runnable: (() => Promise<void>) | undefined = this.runnables.get(original.jobName);
		if (runnable === undefined) {
			return null;
		}
		await this.run(original.jobName, runnable);
		// The retry entry is the newest in the buffer.
		const result = this.store.listJobs({ page: 1, pageSize: 1 });
		return result.items[0] ?? null;
	}
}

/** JSON-compatible payload — sized but never stored (PII stays out of the log). */
type TelescopeJsonValueForJob = string | number | boolean | null | readonly TelescopeJsonValueForJob[] | { readonly [key: string]: TelescopeJsonValueForJob };
