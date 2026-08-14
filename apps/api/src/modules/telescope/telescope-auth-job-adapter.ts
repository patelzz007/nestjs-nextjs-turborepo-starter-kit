import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import type { Subscription } from "rxjs";

import { type TelescopeOptions } from "@workspace/shared";

import { AuthEventsService, type AuthFlowEvent } from "../auth/services/auth-events.service.js";

import { TelescopeAlertService } from "./telescope-alert.service.js";
import { TelescopeEventBus } from "./telescope-event-bus.js";
import { TelescopeJobRecorder } from "./telescope-job-recorder.js";
import { TELESCOPE_OPTIONS, TELESCOPE_STORE } from "./telescope.options.js";
import type { TelescopeStore } from "./telescope.store.js";

/**
 * Auto-capture adapter for the credential/identity flows — signup, login
 * (success AND the security-relevant failures: locked account, bad
 * credentials), forgot/reset password, email verification. Each completed
 * flow becomes a telescope job `auth:<flow>` with the flow's wall-clock
 * duration and the request correlation id it ran inside.
 *
 * Business code emits plain domain events (`AuthEventsService.emitFlow`) and
 * has zero telescope references; this adapter is the only telescope-side
 * observer. Recording mechanics live in {@link TelescopeJobRecorder}.
 */
@Injectable()
export class TelescopeAuthJobAdapter implements OnModuleInit, OnModuleDestroy {
	private readonly recorder: TelescopeJobRecorder;
	private subscription: Subscription | undefined;

	public constructor(
		@Inject(TELESCOPE_OPTIONS) options: TelescopeOptions,
		@Inject(TELESCOPE_STORE) store: TelescopeStore,
		eventBus: TelescopeEventBus,
		private readonly authEvents: AuthEventsService,
		alertService?: TelescopeAlertService,
	) {
		this.recorder = new TelescopeJobRecorder(options, store, eventBus, alertService);
	}

	public onModuleInit(): void {
		// Fail-closed: the observer never attaches while Telescope is disabled.
		if (!this.recorder.enabled) {
			return;
		}
		this.subscription = this.authEvents.observeFlows().subscribe((event: AuthFlowEvent): void => {
			this.record(event);
		});
	}

	public onModuleDestroy(): void {
		this.subscription?.unsubscribe();
	}

	private record(event: AuthFlowEvent): void {
		this.recorder.record({
			jobName: `auth:${event.flow}`,
			status: event.status === "failed" ? "failed" : "succeeded",
			durationMs: event.durationMs,
			error: event.error,
		});
	}
}
