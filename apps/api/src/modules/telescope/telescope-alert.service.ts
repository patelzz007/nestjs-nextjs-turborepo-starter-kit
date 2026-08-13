import { Inject, Injectable } from "@nestjs/common";
import { nanoid } from "nanoid";

import { type RequestLogEntry, type TelescopeAlertEntry, type TelescopeAlertReason, type TelescopeOptions } from "@workspace/shared";

import { TELESCOPE_OPTIONS, TELESCOPE_STORE } from "./telescope.options.js";
import type { TelescopeStore } from "./telescope.store.js"; /**
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
 */
interface DedupeKey {
	readonly key: string;
	readonly firedAt: number;
}

@Injectable()
// eslint-disable-next-line @darraghor/nestjs-typed/injectable-should-be-provided -- Registered in TelescopeModule.register()'s dynamic providers; the typed plugin only scans static @Module decorators.
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
			method: entry.method,
			path: entry.path,
			statusCode: entry.statusCode,
			durationMs: entry.durationMs,
			reason,
			firedAt: new Date().toISOString(),
		};
		this.store.pushAlert(alert);
		this.fireWebhook(alert);
	}

	public listAlerts(limit: number): readonly TelescopeAlertEntry[] {
		return this.store.listAlerts(limit);
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

	private fireWebhook(alert: TelescopeAlertEntry): void {
		const url: string | undefined = this.options.alertWebhookUrl;
		if (url === undefined) {
			return;
		}
		void fetch(url, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(alert),
			signal: AbortSignal.timeout(5000),
		}).catch((err: Error): void => {
			console.warn(`[Telescope] alert webhook failed: ${err.message}`);
		});
	}
}
