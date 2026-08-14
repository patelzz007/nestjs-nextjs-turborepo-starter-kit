// ============================================
// lib/use-telescope-live.ts - SSE subscription hook
// ============================================
// Improvement 2: replaces polling. Subscribes to `GET /telescope/stream`
// (Server-Sent Events) and fires `onEvent` whenever the API captures a new
// request or exception, so dashboards refetch on push instead of on a timer.
//
// Improvement 7 (SSE resume with replay): the stream is consumed via `fetch`
// (not the native EventSource) so we control the `Last-Event-ID` header. Each
// published frame carries a monotonic server `seq` (the SSE `id:` field); on a
// reconnect we send the last seen seq and the API replays the buffered frames
// we missed while disconnected. No events are lost across gaps.
//
// Improvement 8 (reconnect backoff + jitter): instead of the browser's fixed
// reconnect cadence, reconnects use exponential backoff (1s → 2s → 4s …,
// capped at 30s) plus random jitter so a flapping socket doesn't hammer the
// API, and a closed stream never silently dies.
//
// Same-origin proxy: the stream is fetched from `/api/telescope/stream` on
// THIS app's origin (not the API's), which is proxied server-side to the API
// by `app/api/telescope/stream/route.ts`. Same-origin means no CORS preflight
// ever runs — `Last-Event-ID` (not a CORS-safelisted header) used to trigger a
// preflight on every reconnect, which the API's allowedHeaders rejected and
// wedged the stream on "reconnecting…" forever. The proxy forwards the admin
// cookies + `Last-Event-ID`, and silently rotates an expired access token.
//
// Improvement v2 (SSE live UI polish):
// - each frame is parsed through `TelescopeStreamEventSchema` and buffered
//   (last 50) so pages can render a live activity feed without a refetch,
// - `eventCount` / `lastEventAt` / `reconnectCount` power the connection
//   chip ("12 events · last 3s ago · 1 reconnect"),
// - `pause()` / `resume()` let the user freeze the stream (the fetch body
//   reader is aborted, not just ignored — no background socket),
// - the stream auto-pauses when the tab is hidden and resumes on focus.
//
// Auth rides the admin cookie (`credentials: "include"`), same as every
// api.procedure fetch.

"use client";

import { TelescopeStreamEventSchema, type TelescopeStreamEvent } from "@workspace/shared";
import { useCallback, useEffect, useRef, useState } from "react";

/** How many recent events the buffer keeps (feed rows + badge counts). */
const MAX_EVENTS = 50;

/** Reconnect backoff bounds (improvement 8). */
const BACKOFF_MIN_MS = 1000;
const BACKOFF_MAX_MS = 30_000;

/**
 * A buffered frame with feed metadata. Must be a type-alias intersection
 * (NOT an `interface extends`): `TelescopeStreamEvent` is a discriminated
 * union, and interfaces cannot extend union types — the intersection keeps
 * the `type` discriminant so consumers narrow on it as usual.
 */
export type LiveFeedEvent = TelescopeStreamEvent & {
	/** Server-assigned sequence (the SSE `id:` field) — the stable React key and the Last-Event-ID cursor. */
	readonly seq: number;
	/** Epoch ms the frame was received — powers "X ago" labels. */
	readonly receivedAt: number;
};

export interface UseTelescopeLiveResult {
	readonly connected: boolean;
	/** Recent stream frames, oldest-first (rendered newest-first by the feed). */
	readonly events: readonly LiveFeedEvent[];
	/** Total frames received since mount (or since the last resume). */
	readonly eventCount: number;
	/** Epoch ms of the most recent frame, or null before the first push. */
	readonly lastEventAt: number | null;
	/** How many times the socket dropped and auto-reconnected. */
	readonly reconnectCount: number;
	readonly paused: boolean;
	readonly pause: () => void;
	readonly resume: () => void;
}

/** Minimal SSE frame accumulator — a single `id:` + one-or-more `data:` lines. */
interface SseFrame {
	readonly id: string;
	readonly data: string;
}

export function useTelescopeLive(onEvent: (event: TelescopeStreamEvent) => void): UseTelescopeLiveResult {
	const [connected, setConnected] = useState<boolean>(false);
	const [events, setEvents] = useState<readonly LiveFeedEvent[]>([]);
	const [eventCount, setEventCount] = useState<number>(0);
	const [lastEventAt, setLastEventAt] = useState<number | null>(null);
	const [reconnectCount, setReconnectCount] = useState<number>(0);
	const [paused, setPaused] = useState<boolean>(false);

	const onEventRef = useRef<(event: TelescopeStreamEvent) => void>(onEvent);
	const lastSeqRef = useRef<number>(0);
	const aborterRef = useRef<AbortController | null>(null);
	const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const reconnectAttemptRef = useRef<number>(0);
	const pausedRef = useRef<boolean>(false);
	const mountedRef = useRef<boolean>(true);

	// Keep the latest callback without re-creating the stream.
	useEffect((): void => {
		onEventRef.current = onEvent;
	}, [onEvent]);

	/** Push a validated frame into the buffer + counters. */
	const ingestFrame = useCallback((frame: SseFrame): void => {
		const parsed = TelescopeStreamEventSchema.safeParse(JSON.parse(frame.data));
		if (!parsed.success) {
			return;
		}
		lastSeqRef.current = Number.parseInt(frame.id, 10) || lastSeqRef.current + 1;
		const liveEvent: LiveFeedEvent = { ...parsed.data, seq: lastSeqRef.current, receivedAt: Date.now() };
		setEvents((current: readonly LiveFeedEvent[]): readonly LiveFeedEvent[] => {
			const next: LiveFeedEvent[] = [...current, liveEvent];
			return next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next;
		});
		setEventCount((count: number): number => count + 1);
		setLastEventAt(liveEvent.receivedAt);
		onEventRef.current(liveEvent);
	}, []);

	const close = useCallback((): void => {
		aborterRef.current?.abort();
		aborterRef.current = null;
		if (retryTimerRef.current !== null) {
			clearTimeout(retryTimerRef.current);
			retryTimerRef.current = null;
		}
		setConnected(false);
	}, []);

	/** Open (or reconnect) the fetch stream, replaying from `lastSeqRef`. */
	const open = useCallback((): void => {
		if (pausedRef.current || !mountedRef.current) {
			return;
		}
		aborterRef.current?.abort();
		const aborter: AbortController = new AbortController();
		aborterRef.current = aborter;

		const attempt: number = reconnectAttemptRef.current;
		void (async (): Promise<void> => {
			try {
				// Same-origin (proxied by the route handler) — cookies flow
				// automatically; `credentials` kept explicit for clarity.
				const response: Response = await fetch("/api/telescope/stream", {
					credentials: "include",
					// `Accept: text/event-stream` is required — the global
					// ResponseInterceptor bypasses its `{ success, data, meta }`
					// envelope only for that Accept, so without it every frame
					// arrives wrapped and the strict schema parse below rejects
					// everything (the old EventSource sent this natively).
					headers: { Accept: "text/event-stream", ...(lastSeqRef.current > 0 ? { "Last-Event-ID": String(lastSeqRef.current) } : {}) },
					signal: aborter.signal,
				});
				if (!response.ok || response.body === null) {
					throw new Error(`stream HTTP ${String(response.status)}`);
				}
				// Connected only after the first response headers — a 401/403
				// lands here as an HTTP error, not a silent reconnect loop.
				setConnected(true);
				reconnectAttemptRef.current = 0;

				const reader: ReadableStreamDefaultReader<Uint8Array> = response.body.getReader();
				const decoder: TextDecoder = new TextDecoder();
				// One SSE event may arrive split across chunks — accumulate.
				let buffer = "";
				let frameId = "";
				let frameData = "";

				const dispatch = (): void => {
					if (frameData.length > 0) {
						ingestFrame({ id: frameId, data: frameData });
					}
					frameId = "";
					frameData = "";
				};

				for (;;) {
					const { done, value } = await reader.read();
					if (done) {
						break;
					}
					buffer += decoder.decode(value, { stream: true });
					// SSE frames are separated by a blank line.
					const blocks: string[] = buffer.split("\n\n");
					buffer = blocks.pop() ?? "";
					for (const block of blocks) {
						for (const line of block.split("\n")) {
							if (line.startsWith("id:")) {
								frameId = line.slice(3).trim();
							} else if (line.startsWith("data:")) {
								frameData = line.slice(5).trim();
							}
						}
						dispatch();
					}
				}
				// Stream closed by the server (e.g. API restart) — reconnect.
				throw new Error("stream closed");
			} catch {
				if (aborter.signal.aborted || !mountedRef.current) {
					return;
				}
				setConnected(false);
				// Exponential backoff + jitter, capped at 30s (improvement 8).
				const base: number = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** Math.min(attempt, 6));
				const delayMs: number = Math.floor(base * (0.5 + Math.random() * 0.5));
				setReconnectCount((count: number): number => count + 1);
				reconnectAttemptRef.current = attempt + 1;
				if (retryTimerRef.current !== null) {
					clearTimeout(retryTimerRef.current);
				}
				retryTimerRef.current = setTimeout((): void => {
					retryTimerRef.current = null;
					open();
				}, delayMs);
			}
		})();
	}, [ingestFrame]);

	const pause = useCallback((): void => {
		pausedRef.current = true;
		setPaused(true);
		close();
	}, [close]);

	const resume = useCallback((): void => {
		pausedRef.current = false;
		setPaused(false);
		reconnectAttemptRef.current = 0;
		open();
	}, [open]);

	// Mount/unmount lifecycle + visibility-based auto-pause.
	useEffect((): (() => void) => {
		mountedRef.current = true;
		open();

		const onVisibilityChange = (): void => {
			if (document.visibilityState === "hidden") {
				close();
			} else if (!pausedRef.current) {
				open();
			}
		};
		document.addEventListener("visibilitychange", onVisibilityChange);

		return (): void => {
			mountedRef.current = false;
			document.removeEventListener("visibilitychange", onVisibilityChange);
			close();
		};
	}, [open, close]);

	return { connected, events, eventCount, lastEventAt, reconnectCount, paused, pause, resume };
}
