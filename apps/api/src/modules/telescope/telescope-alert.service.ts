import { Inject, Injectable } from "@nestjs/common";
import { nanoid } from "nanoid";

import {
	type RequestLogEntry,
	type TelescopeAlertEntry,
	type TelescopeAlertReason,
	type TelescopeAlertStatus,
	type TelescopeJobLogEntry,
	type TelescopeOptions,
	type TelescopeWebhookDelivery,
} from "@workspace/shared";

import { TELESCOPE_OPTIONS, TELESCOPE_STORE } from "./telescope.options.js";
import type { TelescopeStore } from "./telescope.store.js";
/**
 * Feature 18 — threshold alerts.
 *
 * Evaluates every captured request against the configured thresholds:
 * - `durationMs >= alertDurationMs` → reason "duration",
 * - `statusCode >= 500` → reason "error".
 *
 * Alerts are ALWAYS stored (deduped per route+reason within
 * `TELESCOPE_ALERT_WINDOW_MINUTES` so a failing endpoint doesn't flood the
 * dashboard); the `TELESCOPE_ALERT_WEBHOOK_URL` setting only gates the
 * outbound webhook POST, not the in-app record.
 *
 * Improvement 5 — triage:
 * - `acknowledge(id)` marks an alert acknowledged ("resolved" for the team),
 * - `snooze(id, minutes)` marks it snoozed until a deadline,
 * - a NEW fire of the same route+reason supersedes (auto-resolves) any still-
 *   open alerts for that route+reason — a route that stopped failing then
 *   failed again shows the latest alert as open, old ones as acknowledged.
 *
 * Improvement 16 — the webhook POST retries transient failures with backoff
 * (2 retries at 500ms / 2s), so a blip in the endpoint or network doesn't
 * silently drop the alert.
 */
interface DedupeKey {
	readonly key: string;
	readonly firedAt: number;
}

@Injectable()
export class TelescopeAlertService {
	private readonly dedupe = new Map<string, DedupeKey>();

	public constructor(
		@Inject(TELESCOPE_OPTIONS) private readonly options: TelescopeOptions,
		@Inject(TELESCOPE_STORE) private readonly store: TelescopeStore,
	) {}

	/** Called by the interceptor after a request lands in the store. */
	public evaluate(entry: RequestLogEntry): void {
		const reason: TelescopeAlertReason | null = this.detectReason(entry);
		if (reason === null) {
			return;
		}
		const key = `${entry.method} ${entry.path}#${reason}`;
		const previous: DedupeKey | undefined = this.dedupe.get(key);
		const windowMs: number = this.options.alertWindowMinutes * 60 * 1000;
		if (previous !== undefined && Date.now() - previous.firedAt < windowMs) {
			return;
		}
		this.dedupe.set(key, { key, firedAt: Date.now() });
		if (this.dedupe.size > 500) {
			const oldestKey: string | undefined = this.dedupe.keys().next().value;
			if (oldestKey !== undefined) {
				this.dedupe.delete(oldestKey);
			}
		}

		const alert: TelescopeAlertEntry = {
			id: nanoid(),
			requestId: entry.id,
			jobName: null,
			method: entry.method,
			path: entry.path,
			statusCode: entry.statusCode,
			durationMs: entry.durationMs,
			reason,
			firedAt: new Date().toISOString(),
			status: "open",
			snoozedUntil: null,
		};
		// Improvement 5 — a new fire supersedes any open alert on the same
		// route+reason: the old one becomes acknowledged ("resolved").
		this.supersedeOpen(alert);
		this.store.pushAlert(alert);
		void this.fireWebhook(alert);
	}

	/**
	 * Called by the job recorder when a job finishes FAILED. Any failed job
	 * (email send, auth flow, impersonation, scheduled task, …) becomes an
	 * alert with reason `"job"`, deduped per job name within the same
	 * `TELESCOPE_ALERT_WINDOW_MINUTES` window so a repeatedly-failing job
	 * doesn't flood the panel. `requestId` is the job's correlation id when it
	 * ran inside a captured request, else null (the panel then links to the
	 * jobs page instead).
	 */
	public evaluateJob(job: TelescopeJobLogEntry): void {
		if (job.status !== "failed") {
			return;
		}
		const key = `${job.jobName}#job`;
		const previous: DedupeKey | undefined = this.dedupe.get(key);
		const windowMs: number = this.options.alertWindowMinutes * 60 * 1000;
		if (previous !== undefined && Date.now() - previous.firedAt < windowMs) {
			return;
		}
		this.dedupe.set(key, { key, firedAt: Date.now() });
		if (this.dedupe.size > 500) {
			const oldestKey: string | undefined = this.dedupe.keys().next().value;
			if (oldestKey !== undefined) {
				this.dedupe.delete(oldestKey);
			}
		}

		const alert: TelescopeAlertEntry = {
			id: nanoid(),
			requestId: job.correlationId,
			jobName: job.jobName,
			method: "JOB",
			path: job.jobName,
			statusCode: null,
			durationMs: job.durationMs ?? 0,
			reason: "job",
			firedAt: new Date().toISOString(),
			status: "open",
			snoozedUntil: null,
		};
		this.supersedeOpen(alert);
		this.store.pushAlert(alert);
		void this.fireWebhook(alert);
	}

	public listAlerts(limit: number): readonly TelescopeAlertEntry[] {
		return this.store.listAlerts(limit);
	}

	/** Improvement 5 — acknowledge (resolve) an alert by id. */
	public acknowledge(id: string): TelescopeAlertEntry | null {
		return this.setStatus(id, "acknowledged", null);
	}

	/** Improvement 5 — snooze an alert until now + `minutes`. */
	public snooze(id: string, minutes: number): TelescopeAlertEntry | null {
		const until: string = new Date(Date.now() + minutes * 60 * 1000).toISOString();
		return this.setStatus(id, "snoozed", until);
	}

	private setStatus(id: string, status: TelescopeAlertStatus, snoozedUntil: string | null): TelescopeAlertEntry | null {
		const current: TelescopeAlertEntry | null = this.store.listAlerts(200).find((candidate: TelescopeAlertEntry): boolean => candidate.id === id) ?? null;
		if (current === null) {
			return null;
		}
		this.store.setAlertStatus(id, status, snoozedUntil);
		return { ...current, status, snoozedUntil };
	}

	/** Old open alerts on the same route+reason flip to acknowledged. */
	private supersedeOpen(fresh: TelescopeAlertEntry): void {
		for (const alert of this.store.listAlerts(200)) {
			if (alert.id !== fresh.id && alert.status === "open" && alert.method === fresh.method && alert.path === fresh.path && alert.reason === fresh.reason) {
				this.store.setAlertStatus(alert.id, "acknowledged", null);
			}
		}
	}

	/** Thresholds are opt-in (webhook set) — detection is cheap either way. */
	public reasonFor(entry: RequestLogEntry): TelescopeAlertReason | null {
		return this.detectReason(entry);
	}

	private detectReason(entry: RequestLogEntry): TelescopeAlertReason | null {
		if ((entry.statusCode ?? 500) >= 500) {
			return "error";
		}
		if (entry.durationMs >= this.options.alertDurationMs) {
			return "duration";
		}
		return null;
	}

	/**
	 * Improvement 16 — webhook POST with 2 backoff retries for transient
	 * failures. Feature 13 — every attempt is recorded as a webhook delivery
	 * row (success/failure + status + latency + attempt index), so the alerts
	 * panel can show whether the webhook actually went out.
	 */
	private async fireWebhook(alert: TelescopeAlertEntry): Promise<void> {
		const url: string | undefined = this.options.alertWebhookUrl;
		if (url === undefined) {
			return;
		}
		// First attempt immediately, then up to `delaysMs.length` retries with
		// backoff (500ms, 2s) — transient 5xx/network failures self-heal.
		const delaysMs: readonly number[] = [500, 2000];
		const sleep = async (ms: number): Promise<void> =>
			new Promise<void>((resolve): void => {
				setTimeout(resolve, ms);
			});
		let delivered = false;
		let attempt = 0;
		for (const delayMs of [0, ...delaysMs]) {
			if (delayMs > 0) {
				await sleep(delayMs);
			}
			const outcome: TelescopeWebhookDelivery = await this.postWebhook(url, alert, attempt);
			this.store.pushWebhookDelivery(outcome);
			delivered = outcome.status === "success";
			attempt += 1;
			if (delivered) {
				break;
			}
		}
		if (!delivered) {
			console.warn(`[Telescope] alert webhook failed after ${String(attempt)} attempts: ${url}`);
		}
	}

	/**
	 * One POST attempt → a delivery record. Success = 2xx; anything else
	 * (non-2xx or a network/timeout failure) is a retryable failure.
	 */
	private async postWebhook(url: string, alert: TelescopeAlertEntry, attempt: number): Promise<TelescopeWebhookDelivery> {
		const id: string = nanoid();
		const start: number = performance.now();
		try {
			const response: Response = await fetch(url, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(alert),
				signal: AbortSignal.timeout(5000),
			});
			const durationMs: number = Math.round(performance.now() - start);
			if (response.ok) {
				return {
					id,
					alertId: alert.id,
					status: "success",
					statusCode: response.status,
					durationMs,
					attempt,
					error: null,
					createdAt: new Date().toISOString(),
				};
			}
			return {
				id,
				alertId: alert.id,
				status: "failed",
				statusCode: response.status,
				durationMs,
				attempt,
				error: `HTTP ${String(response.status)}`,
				createdAt: new Date().toISOString(),
			};
		} catch (caught) {
			const durationMs: number = Math.round(performance.now() - start);
			return {
				id,
				alertId: alert.id,
				status: "failed",
				statusCode: null,
				durationMs,
				attempt,
				error: caught instanceof Error ? caught.message : String(caught),
				createdAt: new Date().toISOString(),
			};
		}
	}
}
