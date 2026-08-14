import { Injectable } from "@nestjs/common";
import { merge, type Observable, of, Subject } from "rxjs";

import type { BufferedStreamEvent, TelescopeStreamEvent } from "@workspace/shared";

/** How many recent frames the bus keeps for replay after a reconnect. */
const REPLAY_BUFFER_SIZE = 200;

/**
 * Publish/subscribe bus for the live stream (improvement 2 — SSE, and
 * improvement 7 — replay). The capture interceptor publishes after a
 * request/exception lands in the store; the `GET /telescope/stream` SSE
 * handler subscribes.
 *
 * Each publish is stamped with a monotonic `seq` and retained in a ring
 * buffer, so a client that dropped its socket can reconnect with
 * `Last-Event-ID` and receive everything it missed instead of only new
 * events. The buffer is bounded (200) — a client that stays away longer
 * simply starts from the newest frames (the REST endpoints are always the
 * source of truth for full history).
 */
@Injectable()
export class TelescopeEventBus {
	private readonly live$: Subject<BufferedStreamEvent> = new Subject<BufferedStreamEvent>();
	private readonly buffer: BufferedStreamEvent[] = [];
	private lastSeq = 0;

	/** Called by the capture pipeline after a store write. */
	public publish(event: TelescopeStreamEvent): void {
		this.lastSeq += 1;
		const stamped: BufferedStreamEvent = { seq: this.lastSeq, event };
		this.buffer.push(stamped);
		if (this.buffer.length > REPLAY_BUFFER_SIZE) {
			this.buffer.shift();
		}
		this.live$.next(stamped);
	}

	/**
	 * The observable the `@Sse()` handler maps into `MessageEvent` frames.
	 * When `afterSeq > 0`, buffered frames newer than that seq are replayed
	 * first (in order), then live frames stream on. Replaying the buffer is
	 * cheap and idempotent — frames carry their own seq, so a client that
	 * already saw some of them simply ignores the duplicates.
	 */
	public subscribe(afterSeq: number): Observable<BufferedStreamEvent> {
		const replayed: readonly BufferedStreamEvent[] = this.buffer.filter((entry: BufferedStreamEvent): boolean => entry.seq > afterSeq);
		return merge(of(...replayed), this.live$);
	}
}
