import {
	measureNetworkQuality,
	NETWORK_TEST_INTERVAL_MS,
	networkQualityReadingOf,
	type LatencyProbe,
	type NetworkQualityReading,
	type TimedNetworkQuality,
} from "./network-quality";

/**
 * When a connection test runs, for every app: right away, every
 * {@link NETWORK_TEST_INTERVAL_MS} while the app is in view, when it comes back
 * into view with an older result, when the device comes back online, and on
 * request. An app out of view (a hidden tab, a backgrounded phone app) never
 * tests, and a test never overlaps another.
 *
 * Going offline cancels a running test and forgets the last result, so the
 * indicator shows "measuring" after reconnecting instead of figures from before
 * the drop.
 *
 * Framework-free: the web apps feed it the browser's `online` / `offline` and
 * `visibilitychange` events (`useNetworkQuality` in @workspace/client), the
 * mobile app its network state and AppState (`AppStatusProvider`), and both
 * read it through `subscribe` / `getSnapshot` — the shape React's
 * `useSyncExternalStore` takes.
 */

export interface NetworkQualitySnapshot {
	readonly reading: NetworkQualityReading;
	/** A test is running (the first one, or a re-test while the last result stays on screen). */
	readonly testing: boolean;
}

export interface NetworkQualityMonitorOptions {
	/** One request of a test (`GET /health/ping` on the API). */
	readonly probe: LatencyProbe;
	/** A monotonic clock in ms for round trips (`performance.now`). */
	readonly now: () => number;
	/** Wall-clock epoch ms for when a test finished (`Date.now`). */
	readonly clock: () => number;
	readonly intervalMs?: number;
	/** What the device says before its first event (the web apps count as online until hydration has run). */
	readonly online?: boolean;
	readonly visible?: boolean;
}

/** Before anything is known: online, nothing measured, nothing running. */
export const INITIAL_NETWORK_QUALITY_SNAPSHOT: NetworkQualitySnapshot = { reading: { status: "measuring" }, testing: false };

export class NetworkQualityMonitor {
	private readonly _listeners = new Set<() => void>();
	private readonly _intervalMs: number;
	private _online: boolean;
	private _visible: boolean;
	private _latest: TimedNetworkQuality | null = null;
	private _running: AbortController | null = null;
	private _timer: ReturnType<typeof setInterval> | null = null;
	private _snapshot: NetworkQualitySnapshot;

	public constructor(private readonly _options: NetworkQualityMonitorOptions) {
		this._intervalMs = _options.intervalMs ?? NETWORK_TEST_INTERVAL_MS;
		this._online = _options.online ?? true;
		this._visible = _options.visible ?? true;
		this._snapshot = this.read();
	}

	/** Calls `listener` after every change of the snapshot; returns the unsubscribe. */
	public readonly subscribe = (listener: () => void): (() => void) => {
		this._listeners.add(listener);
		return (): void => {
			this._listeners.delete(listener);
		};
	};

	/** The current snapshot — the same object until something changes. */
	public readonly getSnapshot = (): NetworkQualitySnapshot => this._snapshot;

	/** Starts the schedule (and a test, unless a fresh result is at hand). */
	public start(): void {
		if (this._timer !== null) {
			return;
		}
		this._timer = setInterval((): void => {
			this.testIfStale();
		}, this._intervalMs);
		this.testIfStale();
	}

	/** Stops the schedule and cancels a running test. */
	public stop(): void {
		if (this._timer !== null) {
			clearInterval(this._timer);
			this._timer = null;
		}
		this.cancel();
	}

	public setOnline(online: boolean): void {
		if (online === this._online) {
			return;
		}
		this._online = online;
		if (!online) {
			this._latest = null;
			this.cancel();
		}
		this.publish();
		this.testIfStale();
	}

	public setVisible(visible: boolean): void {
		if (visible === this._visible) {
			return;
		}
		this._visible = visible;
		this.testIfStale();
	}

	/** Starts a test now, unless one is running or the device is offline. */
	public readonly testNow = (): void => {
		void this.runTest();
	};

	private testIfStale(): void {
		const last = this._latest;
		if (this._timer !== null && this._visible && (last === null || this._options.clock() - last.measuredAtMs >= this._intervalMs)) {
			void this.runTest();
		}
	}

	private async runTest(): Promise<void> {
		if (this._running !== null || !this._online) {
			return;
		}
		const controller = new AbortController();
		this._running = controller;
		this.publish();
		try {
			const quality = await measureNetworkQuality({ probe: this._options.probe, now: this._options.now, signal: controller.signal });
			if (!controller.signal.aborted) {
				this._latest = { quality, measuredAtMs: this._options.clock() };
			}
		} finally {
			if (this._running === controller) {
				this._running = null;
				this.publish();
			}
		}
	}

	private cancel(): void {
		if (this._running !== null) {
			this._running.abort();
			this._running = null;
			this.publish();
		}
	}

	private read(): NetworkQualitySnapshot {
		return { reading: networkQualityReadingOf(this._online, this._latest), testing: this._running !== null };
	}

	private publish(): void {
		this._snapshot = this.read();
		for (const listener of this._listeners) {
			listener();
		}
	}
}
