import { EXPOSURE_BATCH_MAX, exposureDedupeKey, type Exposure } from "../schemas/bundle";

/** Noted exposures are sent at least this often. */
export const EXPOSURE_FLUSH_MS = 10_000;

/** Timer functions, injected so tests control time (and each runtime passes its own). */
export interface ExposureTimers {
	readonly setTimeout: (callback: () => void, delayMs: number) => number;
	readonly clearTimeout: (handle: number) => void;
}

/**
 * The exposures a client makes (ADR 087), the same in the web apps and the mobile app: each decision is noted once
 * per session (the same flag, revision, rule and value), and the notes go to the API in batches of up to 50, ten
 * seconds after the first of a batch or as soon as 50 are waiting. Sending never throws: an exposure is never worth
 * breaking a screen over.
 */
export class ExposureQueue {
	private readonly _seen = new Set<string>();
	private _pending: Exposure[] = [];
	private _timer: number | null = null;

	public constructor(
		private readonly _send: (exposures: readonly Exposure[]) => Promise<void>,
		private readonly _timers: ExposureTimers,
	) {}

	public note(exposure: Exposure): void {
		const key = exposureDedupeKey(exposure);
		if (this._seen.has(key)) {
			return;
		}
		this._seen.add(key);
		this._pending.push(exposure);
		if (this._pending.length >= EXPOSURE_BATCH_MAX) {
			void this.flush();
			return;
		}
		this._timer ??= this._timers.setTimeout((): void => {
			void this.flush();
		}, EXPOSURE_FLUSH_MS);
	}

	/** Sends everything waiting, in batches; the timer restarts with the next note. */
	public async flush(): Promise<void> {
		if (this._timer !== null) {
			this._timers.clearTimeout(this._timer);
			this._timer = null;
		}
		while (this._pending.length > 0) {
			const batch = this._pending.slice(0, EXPOSURE_BATCH_MAX);
			this._pending = this._pending.slice(EXPOSURE_BATCH_MAX);
			try {
				await this._send(batch);
			} catch {
				// Dropped on purpose: an exposure is telemetry, and the next screen view notes it again.
			}
		}
	}

	/** Forget what was seen (a new session: another person may now be signed in). */
	public reset(): void {
		this._seen.clear();
		this._pending = [];
	}
}
