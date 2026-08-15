// ============================================
// lib/email-log-live.ts - Live EmailLog updates (SSE)
// ============================================
"use client";

import { API_BASE_URL } from "@workspace/client/lib/api/config";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";

/** SSE endpoint on the API — must match `EmailLogController.stream()`. */
export const EMAIL_LOG_EVENTS_PATH = "/notifications/email-log/events";

/**
 * Connection state of the live stream, surfaced by the "Live" pill.
 *
 * - `connecting` — initial connect, or EventSource auto-reconnecting after a
 *   drop (EventSource reuses the CONNECTING ready-state for both, so a first
 *   connect and a reconnect are indistinguishable by design).
 * - `open` — connected, updates flow.
 * - `closed` — the stream is not expected to recover (only reachable after an
 *   explicit close; EventSource always retries drops itself).
 */
export const LiveStateSchema = z.enum(["connecting", "open", "closed"]);

export type LiveState = z.output<typeof LiveStateSchema>;

// EventSource.readyState constants (spec-defined: 0 CONNECTING, 1 OPEN, 2
// CLOSED). Declared locally so the mapper is testable in jsdom, where the
// EventSource global is not available.
const READY_CONNECTING = 0;
const READY_OPEN = 1;

/** Map a raw `EventSource.readyState` number to the exposed `LiveState`. */
export function mapReadyState(readyState: number): LiveState {
	if (readyState === READY_OPEN) {
		return "open";
	}
	if (readyState === READY_CONNECTING) {
		return "connecting";
	}
	return "closed";
}

/**
 * Subscribe to the EmailLog SSE stream.
 *
 * Every frame is a "something changed" signal: the hook invalidates the
 * email-log list query, which refetches through the normal schema-validated
 * pipeline (including the 401 → silent-refresh flow), so the table rows update
 * the instant a webhook flips a status — no polling, no manual refresh.
 *
 * Cookies are the only auth transport SSE supports (EventSource cannot set
 * Authorization headers), hence `withCredentials: true` — the API reads the
 * session cookies exactly like the regular fetch calls do.
 *
 * @returns The current connection state for the "Live" pill.
 */
export function useEmailLogLive(): LiveState {
	const queryClient = useQueryClient();
	const [state, setState] = useState<LiveState>("connecting");

	useEffect(() => {
		const url: string = new URL(EMAIL_LOG_EVENTS_PATH, API_BASE_URL).toString();
		const source: EventSource = new EventSource(url, { withCredentials: true });

		const handleOpen = (): void => {
			setState("open");
		};
		const handleMessage = (): void => {
			void queryClient.invalidateQueries({ queryKey: apiRouter.email.logList.queryKey(undefined) });
		};
		const handleError = (): void => {
			// A drop flips readyState back to CONNECTING (auto-reconnect); an
			// explicit close only happens in cleanup, so `closed` is rare.
			setState(mapReadyState(source.readyState));
		};

		source.addEventListener("open", handleOpen);
		source.addEventListener("message", handleMessage);
		source.addEventListener("error", handleError);

		return (): void => {
			source.removeEventListener("open", handleOpen);
			source.removeEventListener("message", handleMessage);
			source.removeEventListener("error", handleError);
			source.close();
		};
	}, [queryClient]);

	return state;
}
