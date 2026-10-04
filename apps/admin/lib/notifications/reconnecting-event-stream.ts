// ============================================
// lib/notifications/reconnecting-event-stream.ts - an SSE subscription that survives session expiry
// ============================================
// The browser's EventSource retries a dropped connection by itself, but a
// non-200 answer (401 once the access token expired, 5xx while the API is
// down) CLOSES it for good. This class owns that gap: on a terminal close it
// rotates the session through the app's single-flight refresh and reopens the
// stream with exponential backoff, until the session is reported expired or
// the subscription is stopped. Every collaborator (the EventSource factory,
// the refresh, the timer) is injected, so the policy is unit-testable and the
// class is reused by any live stream, not just the email log.

import type { RefreshResult } from "@workspace/client/lib/api/api-request";
import { z } from "zod";

/**
 * Connection state of a live stream:
 * - `connecting` — first connect, the browser's own retry, or our reconnect after a close;
 * - `open` — connected, updates flow;
 * - `closed` — will not recover (the session expired, or the stream was stopped).
 */
export const LiveStateSchema = z.enum(["connecting", "open", "closed"]);

export type LiveState = z.output<typeof LiveStateSchema>;

/** `EventSource.readyState` value of a connection the browser is (re)establishing. */
export const EVENT_SOURCE_CONNECTING = 0;
/** `EventSource.readyState` value of an established connection. */
export const EVENT_SOURCE_OPEN = 1;

/** The part of `EventSource` the stream uses — a fake implements it in tests. */
export interface EventSourceLike {
	readonly readyState: number;
	addEventListener(type: "open" | "message" | "error", listener: () => void): void;
	removeEventListener(type: "open" | "message" | "error", listener: () => void): void;
	close(): void;
}

/** Timer functions, injected so tests control time. */
export interface ReconnectScheduler {
	schedule(callback: () => void, delayMs: number): number;
	cancel(handle: number): void;
}

/** Exponential backoff between reconnect attempts. */
export interface ReconnectBackoff {
	readonly initialDelayMs: number;
	readonly maxDelayMs: number;
}

export interface ReconnectingEventStreamOptions {
	readonly openSource: () => EventSourceLike;
	/** The app's single-flight session refresh (`useAuthCommands().refreshSession`). */
	readonly refreshSession: () => Promise<RefreshResult>;
	readonly scheduler: ReconnectScheduler;
	readonly backoff: ReconnectBackoff;
	readonly onMessage: () => void;
	readonly onStateChange: (state: LiveState) => void;
}

/** The first reconnect waits 1 s, then 2 s, 4 s … capped at 30 s. */
export const DEFAULT_RECONNECT_BACKOFF: ReconnectBackoff = { initialDelayMs: 1_000, maxDelayMs: 30_000 };

/** Delay before reconnect attempt `attempt` (0-based): `initial · 2^attempt`, capped. */
export function reconnectDelayMs(backoff: ReconnectBackoff, attempt: number): number {
	return Math.min(backoff.maxDelayMs, backoff.initialDelayMs * 2 ** attempt);
}

export class ReconnectingEventStream {
	private _source: EventSourceLike | null = null;
	private _reconnectHandle: number | null = null;
	private _failedAttempts = 0;
	private _isStopped = true;

	public constructor(private readonly _options: ReconnectingEventStreamOptions) {}

	/** Opens the stream; reconnects on terminal closes until `stop()`. */
	public start(): void {
		this._isStopped = false;
		this.open();
	}

	/** Closes the stream and cancels any pending reconnect. Idempotent. */
	public stop(): void {
		this._isStopped = true;
		this.cancelReconnect();
		this.detach();
	}

	private readonly handleOpen = (): void => {
		this._failedAttempts = 0;
		this._options.onStateChange("open");
	};

	private readonly handleMessage = (): void => {
		this._options.onMessage();
	};

	private readonly handleError = (): void => {
		const source = this._source;
		if (source === null) {
			return;
		}
		if (source.readyState === EVENT_SOURCE_CONNECTING) {
			// The browser is retrying a dropped connection itself.
			this._options.onStateChange("connecting");
			return;
		}
		// Terminal close (e.g. 401 after the access token expired, or a 5xx).
		this.detach();
		this._options.onStateChange("connecting");
		void this.recover();
	};

	private open(): void {
		this._options.onStateChange("connecting");
		const source = this._options.openSource();
		source.addEventListener("open", this.handleOpen);
		source.addEventListener("message", this.handleMessage);
		source.addEventListener("error", this.handleError);
		this._source = source;
	}

	private detach(): void {
		const source = this._source;
		if (source === null) {
			return;
		}
		source.removeEventListener("open", this.handleOpen);
		source.removeEventListener("message", this.handleMessage);
		source.removeEventListener("error", this.handleError);
		source.close();
		this._source = null;
	}

	/** Refreshes the session (a 401 is the usual cause), then reopens after the backoff delay — unless the session is over. */
	private async recover(): Promise<void> {
		const result: RefreshResult = await this._options.refreshSession();
		if (this._isStopped) {
			return;
		}
		if (result === "expired") {
			this._options.onStateChange("closed");
			return;
		}
		const delayMs = reconnectDelayMs(this._options.backoff, this._failedAttempts);
		this._failedAttempts += 1;
		this._reconnectHandle = this._options.scheduler.schedule((): void => {
			this._reconnectHandle = null;
			if (!this._isStopped) {
				this.open();
			}
		}, delayMs);
	}

	private cancelReconnect(): void {
		if (this._reconnectHandle !== null) {
			this._options.scheduler.cancel(this._reconnectHandle);
			this._reconnectHandle = null;
		}
	}
}
