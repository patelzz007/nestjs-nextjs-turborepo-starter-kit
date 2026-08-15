import { nanoid } from "nanoid";

import { epochMs, type EpochMs, type TelescopeJobLogEntry, type TelescopeJobStatus, type TelescopeOptions } from "@workspace/shared";

import { RequestSpanContext, type SpanStore } from "./request-span-context";
import { TelescopeAlertService } from "./telescope-alert.service";
import { TelescopeEventBus } from "./telescope-event-bus";

/**
 * Shared "a unit of work finished" recorder used by every auto-capture job
 * adapter (email sends, auth flows, impersonation). Taking a finished job's
 * facts (name, status, duration, error) it:
 *
 *  1. builds a `TelescopeJobLogEntry` and pushes it into the store,
 *  2. attaches a `queue` span to the request the work ran inside (when that
 *     request is being captured) — mirroring what `TelescopeJobRunner` does
 *     for explicitly-run jobs,
 *  3. publishes a `job` stream frame so the live /telescope/jobs page
 *     refetches on push.
 *
 * Deliberately a plain collaborator (not `@Injectable`): each adapter builds
 * its own instance from its injected options/store/event-bus, so adapter
 * constructor signatures stay small and specs construct it inline. The alert
 * service is optional so specs (and disabled setups) can omit it — when
 * present, a FAILED job also fires a `job` alert on the overview.
 */
export class TelescopeJobRecorder {
	public constructor(
		private readonly options: TelescopeOptions,
		private readonly store: { pushJob(entry: TelescopeJobLogEntry): void },
		private readonly eventBus: TelescopeEventBus,
		private readonly alertService?: TelescopeAlertService,
	) {}

	public get enabled(): boolean {
		return this.options.enabled;
	}

	public record(input: { readonly jobName: string; readonly status: TelescopeJobStatus; readonly durationMs: number; readonly error: string | null }): void {
		if (!this.options.enabled) {
			return;
		}

		const nowMs: number = Date.now();
		const startedAtMs: number = nowMs - input.durationMs;
		const startedAt: EpochMs = epochMs(startedAtMs);
		const finishedAt: EpochMs = epochMs(nowMs);

		const spanStore: SpanStore | undefined = RequestSpanContext.getStore();
		const correlationId: string | null = spanStore?.correlationId ?? null;

		const entry: TelescopeJobLogEntry = {
			id: nanoid(),
			jobName: input.jobName,
			status: input.status,
			durationMs: input.durationMs,
			payloadSize: 0,
			error: input.error,
			correlationId,
			enqueuedAt: startedAt,
			startedAt,
			finishedAt,
		};
		this.store.pushJob(entry);

		// Mirror the job runner's timeline: a `queue` span on the request the
		// work ran inside, when that request is being captured. `startOffsetMs`
		// is performance-clock based (the span axis), so derive it from the
		// current performance clock minus the measured duration.
		if (spanStore?.captured === true) {
			const perfNow: number = performance.now();
			spanStore.spans.push({
				name: `job: ${entry.jobName}`,
				kind: "queue",
				startOffsetMs: Math.max(0, Math.round(perfNow - input.durationMs - spanStore.startedAt)),
				durationMs: input.durationMs,
			});
		}

		// Publish a `job` frame so the /telescope/jobs page refetches on push.
		this.eventBus.publish({
			type: "job",
			id: entry.id,
			jobName: entry.jobName,
			jobStatus: entry.status,
			durationMs: entry.durationMs ?? undefined,
			correlationId,
		});

		// A FAILED job becomes a `job` alert on the overview (deduped by the
		// alert service) so failures surface even when nobody is watching the
		// jobs page.
		if (entry.status === "failed") {
			this.alertService?.evaluateJob(entry);
		}
	}
}
