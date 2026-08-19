import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import type { Subscription } from "rxjs";

import { type TelescopeOptions } from "@workspace/shared";

import { SessionsEventsService } from "../sessions/sessions-events.service";
import { type SessionActionEvent } from "@workspace/shared";

import { TelescopeAlertService } from "./telescope-alert.service";
import { TelescopeEventBus } from "./telescope-event-bus";
import { TelescopeJobRecorder } from "./telescope-job-recorder";
import { TELESCOPE_OPTIONS, TELESCOPE_STORE } from "./telescope.options";
import type { TelescopeStore } from "./telescope.store";

/**
 * How long between `session:refresh` job records. Token refreshes fire far
 * more often than any other job family (every 401-refresh cycle), so without
 * a throttle the jobs list would drown in near-identical rotation entries.
 * One `session:refresh` job per window is plenty for observability; logout
 * actions are rare and always recorded, and FAILED refreshes (token reuse /
 * theft detection) bypass the throttle — those are the ones worth seeing.
 */
const SESSION_REFRESH_THROTTLE_MS = 30_000;

/**
 * Auto-capture adapter for the session lifecycle — token refresh, device
 * logout, logout-all. Each completed action becomes a telescope job
 * `session:<action>`; `session:refresh` is throttled to one record per
 * `SESSION_REFRESH_THROTTLE_MS` window (failed refreshes always record).
 *
 * Business code emits plain domain events (`SessionsEventsService`) and has
 * zero telescope references; this adapter is the only telescope-side
 * observer. Recording mechanics live in {@link TelescopeJobRecorder}.
 */
@Injectable()
export class TelescopeSessionsJobAdapter implements OnModuleInit, OnModuleDestroy {
	private readonly recorder: TelescopeJobRecorder;
	private subscription: Subscription | undefined;
	private lastRefreshRecordedAt = 0;

	public constructor(
		@Inject(TELESCOPE_OPTIONS) options: TelescopeOptions,
		@Inject(TELESCOPE_STORE) store: TelescopeStore,
		eventBus: TelescopeEventBus,
		private readonly sessionsEvents: SessionsEventsService,
		alertService?: TelescopeAlertService,
	) {
		this.recorder = new TelescopeJobRecorder(options, store, eventBus, alertService);
	}

	public onModuleInit(): void {
		// Fail-closed: the observer never attaches while Telescope is disabled.
		if (!this.recorder.enabled) {
			return;
		}
		this.subscription = this.sessionsEvents.observeActions().subscribe((event: SessionActionEvent): void => {
			this.record(event);
		});
	}

	public onModuleDestroy(): void {
		this.subscription?.unsubscribe();
	}

	private record(event: SessionActionEvent): void {
		// Throttle only SUCCEEDED refreshes — they are high-frequency and
		// low-signal. Failed refreshes (token reuse/theft) bypass the throttle.
		if (event.action === "refresh" && event.status === "succeeded") {
			const now: number = Date.now();
			if (now - this.lastRefreshRecordedAt < SESSION_REFRESH_THROTTLE_MS) {
				return;
			}
			this.lastRefreshRecordedAt = now;
		}

		this.recorder.record({
			jobName: `session:${event.action}`,
			status: event.status === "failed" ? "failed" : "succeeded",
			durationMs: event.durationMs,
			error: event.error,
		});
	}
}
