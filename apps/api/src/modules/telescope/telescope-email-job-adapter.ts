import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import type { Subscription } from "rxjs";

import { type TelescopeOptions, type EmailLogUpdatedEvent } from "@workspace/shared";

import { EmailLogEventsService } from "../notifications/email/email-log-events.service";

import { TelescopeAlertService } from "./telescope-alert.service";
import { TelescopeEventBus } from "./telescope-event-bus";
import { TelescopeJobRecorder } from "./telescope-job-recorder";
import { TELESCOPE_OPTIONS, TELESCOPE_STORE } from "./telescope.options";
import type { TelescopeStore } from "./telescope.store";

/**
 * Feature 3 — email sends recorded as telescope jobs WITHOUT any telescope
 * references in business code.
 *
 * Subscribes to the email-log event stream (the same in-process events the
 * admin SSE uses) and, for every REAL send attempt, records a finished job:
 * `send-email:<template>` with duration, status and the correlation id of the
 * request the send ran inside. Webhook status flips (`delivered`, `bounced`,
 * …) carry no attempt payload and are ignored here — the delivery lifecycle
 * already lives on the email-log page.
 *
 * "Real" means the send actually hit the network (mode "send"): noop /
 * log-only persists have no resend id and no duration, so they are skipped —
 * exactly the surface the previous `jobRunner.run()` wrap covered. Because the
 * observer runs in the request's async context (the event fires synchronously
 * inside `EmailLogService.create`), it also adds the same `queue` span to the
 * request timeline the job runner used to.
 *
 * The recording mechanics (entry → store → span → stream frame) live in
 * {@link TelescopeJobRecorder}; this adapter only decides WHICH events become
 * jobs.
 */
@Injectable()
export class TelescopeEmailJobAdapter implements OnModuleInit, OnModuleDestroy {
	private readonly recorder: TelescopeJobRecorder;
	private subscription: Subscription | undefined;

	public constructor(
		@Inject(TELESCOPE_OPTIONS) options: TelescopeOptions,
		@Inject(TELESCOPE_STORE) store: TelescopeStore,
		eventBus: TelescopeEventBus,
		private readonly emailLogEvents: EmailLogEventsService,
		alertService?: TelescopeAlertService,
	) {
		this.recorder = new TelescopeJobRecorder(options, store, eventBus, alertService);
	}

	public onModuleInit(): void {
		// Fail-closed: the observer never attaches while Telescope is disabled.
		if (!this.recorder.enabled) {
			return;
		}
		this.subscription = this.emailLogEvents.observeUpdates().subscribe((event: EmailLogUpdatedEvent | null): void => {
			this.record(event);
		});
	}

	public onModuleDestroy(): void {
		this.subscription?.unsubscribe();
	}

	private record(event: EmailLogUpdatedEvent | null): void {
		if (event === null) {
			return;
		}
		// Only the attempt statuses this adapter can map become jobs — anything
		// else (delivered/bounced/…) arrives via webhook flips that carry no
		// payload and never reach this branch anyway.
		if (event.status !== "sent" && event.status !== "failed") {
			return;
		}
		// A "sent" row without a resend id is a noop/log-only persist — the
		// send never touched the network, so it is not a job.
		if (event.status === "sent" && event.resendId === null) {
			return;
		}

		this.recorder.record({
			jobName: `send-email:${event.templateKey}`,
			status: event.status === "failed" ? "failed" : "succeeded",
			durationMs: event.durationMs ?? 0,
			error: event.error,
		});
	}
}
