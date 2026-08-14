import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import type { Subscription } from "rxjs";

import { type TelescopeOptions } from "@workspace/shared";

import { ImpersonationEventsService, type ImpersonationActionEvent } from "../impersonation/impersonation-events.service.js";

import { TelescopeAlertService } from "./telescope-alert.service.js";
import { TelescopeEventBus } from "./telescope-event-bus.js";
import { TelescopeJobRecorder } from "./telescope-job-recorder.js";
import { TELESCOPE_OPTIONS, TELESCOPE_STORE } from "./telescope.options.js";
import type { TelescopeStore } from "./telescope.store.js";

/**
 * Auto-capture adapter for SuperAdmin impersonation — every completed
 * start/stop becomes a telescope job `impersonation:<action>`. This is a
 * high-signal security operation, so it gets its own job surface on the
 * /telescope/jobs page (the audit-log table is the source of truth; this is
 * the live observability mirror).
 *
 * Business code emits plain domain events (`ImpersonationEventsService`) and
 * has zero telescope references; this adapter is the only telescope-side
 * observer. Recording mechanics live in {@link TelescopeJobRecorder}.
 */
@Injectable()
export class TelescopeImpersonationJobAdapter implements OnModuleInit, OnModuleDestroy {
	private readonly recorder: TelescopeJobRecorder;
	private subscription: Subscription | undefined;

	public constructor(
		@Inject(TELESCOPE_OPTIONS) options: TelescopeOptions,
		@Inject(TELESCOPE_STORE) store: TelescopeStore,
		eventBus: TelescopeEventBus,
		private readonly impersonationEvents: ImpersonationEventsService,
		alertService?: TelescopeAlertService,
	) {
		this.recorder = new TelescopeJobRecorder(options, store, eventBus, alertService);
	}

	public onModuleInit(): void {
		// Fail-closed: the observer never attaches while Telescope is disabled.
		if (!this.recorder.enabled) {
			return;
		}
		this.subscription = this.impersonationEvents.observeActions().subscribe((event: ImpersonationActionEvent): void => {
			this.record(event);
		});
	}

	public onModuleDestroy(): void {
		this.subscription?.unsubscribe();
	}

	private record(event: ImpersonationActionEvent): void {
		this.recorder.record({
			jobName: `impersonation:${event.action}`,
			status: event.status === "failed" ? "failed" : "succeeded",
			durationMs: event.durationMs,
			error: event.error,
		});
	}
}
