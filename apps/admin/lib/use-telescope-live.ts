// ============================================
// lib/use-telescope-live.ts - SSE subscription hook
// ============================================
// Improvement 2: replaces polling. Subscribes to `GET /telescope/stream`
// (Server-Sent Events) and fires `onEvent` whenever the API captures a new
// request or exception, so dashboards refetch on push instead of on a timer.
//
// Improvement v2 (SSE live UI polish):
// - each frame is parsed through `TelescopeStreamEventSchema` and buffered
//   (last 50) so pages can render a live activity feed without a refetch,
// - `eventCount` / `lastEventAt` / `reconnectCount` power the connection
//   chip ("12 events · last 3s ago · 1 reconnect"),
// - `pause()` / `resume()` let the user freeze the stream (the EventSource
//   is closed, not just ignored — no background socket),
// - the stream auto-pauses when the tab is hidden and resumes on focus
//   (browsers throttle hidden tabs anyway; explicit close is cleaner).
//
// Auth rides the admin cookie (`withCredentials`), same as every
// api.procedure fetch.

"use client";

import { API_BASE_URL } from "@workspace/client/lib/api/config";
import { TelescopeStreamEventSchema, type TelescopeStreamEvent } from "@workspace/shared";
import { useCallback, useEffect, useRef, useState } from "react";

/** How many recent events the buffer keeps (feed rows + badge counts). */
const MAX_EVENTS = 50;

/**
 * A buffered frame with feed metadata. Must be a type-alias intersection
 * (NOT an `interface extends`): `TelescopeStreamEvent` is a discriminated
 * union, and interfaces cannot extend union types — the intersection keeps
 * the `type` discriminant so consumers narrow on it as usual.
 */
export type LiveFeedEvent = TelescopeStreamEvent & {
	/** Monotonic sequence — the stable React key for feed rows. */
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

export function useTelescopeLive(onEvent: (event: TelescopeStreamEvent) => void): UseTelescopeLiveResult {
	const [connected, setConnected] = useState<boolean>(false);
	const [events, setEvents] = useState<readonly LiveFeedEvent[]>([]);
	const [eventCount, setEventCount] = useState<number>(0);
	const [lastEventAt, setLastEventAt] = useState<number | null>(null);
	const [reconnectCount, setReconnectCount] = useState<number>(0);
	const [paused, setPaused] = useState<boolean>(false);

	const onEventRef = useRef<(event: TelescopeStreamEvent) => void>(onEvent);
	const seqRef = useRef<number>(0);
	const sourceRef = useRef<EventSource | null>(null);
	const pausedRef = useRef<boolean>(false);

	// Keep the latest callback without re-creating the EventSource.
	useEffect((): void => {
		onEventRef.current = onEvent;
	}, [onEvent]);

	const open = useCallback((): void => {
		if (sourceRef.current !== null) {
			return;
		}
		const source: EventSource = new EventSource(`${API_BASE_URL}/telescope/stream`, { withCredentials: true });

		source.onopen = (): void => {
			setConnected(true);
		};
		source.onerror = (): void => {
			// EventSource reconnects automatically; surface it as a counter.
			setConnected(false);
			setReconnectCount((count: number): number => count + 1);
		};
		source.onmessage = (event: MessageEvent<string>): void => {
			const parsed = TelescopeStreamEventSchema.safeParse(JSON.parse(event.data));
			if (!parsed.success) {
				return;
			}
			seqRef.current += 1;
			const frame: LiveFeedEvent = { ...parsed.data, seq: seqRef.current, receivedAt: Date.now() };
			setEvents((current: readonly LiveFeedEvent[]): readonly LiveFeedEvent[] => {
				const next: LiveFeedEvent[] = [...current, frame];
				return next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next;
			});
			setEventCount((count: number): number => count + 1);
			setLastEventAt(frame.receivedAt);
			onEventRef.current(frame);
		};

		sourceRef.current = source;
	}, []);

	const close = useCallback((): void => {
		sourceRef.current?.close();
		sourceRef.current = null;
		setConnected(false);
	}, []);

	const pause = useCallback((): void => {
		pausedRef.current = true;
		setPaused(true);
		close();
	}, [close]);

	const resume = useCallback((): void => {
		pausedRef.current = false;
		setPaused(false);
		open();
	}, [open]);

	// Mount/unmount lifecycle + visibility-based auto-pause.
	useEffect((): (() => void) => {
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
			document.removeEventListener("visibilitychange", onVisibilityChange);
			close();
		};
	}, [open, close]);

	return { connected, events, eventCount, lastEventAt, reconnectCount, paused, pause, resume };
}
