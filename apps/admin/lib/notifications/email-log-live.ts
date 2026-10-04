// ============================================
// lib/notifications/email-log-live.ts - live EmailLog updates (SSE)
// ============================================
"use client";

import { API_BASE_URL, API_URL_PREFIX } from "@workspace/client/lib/api/config";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { useAuthCommands } from "@workspace/client/lib/auth";
import { apiRoutes } from "@workspace/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { DEFAULT_RECONNECT_BACKOFF, ReconnectingEventStream, type LiveState, type ReconnectScheduler } from "@/lib/notifications/reconnecting-event-stream";

/** The email-log SSE endpoint (`GET /notifications/email-log/events`, LIST EMAIL). */
export function emailLogEventsUrl(): string {
	return new URL(`${API_URL_PREFIX}${apiRoutes.email.logEvents}`, API_BASE_URL).toString();
}

const BROWSER_SCHEDULER: ReconnectScheduler = {
	schedule: (callback: () => void, delayMs: number): number => window.setTimeout(callback, delayMs),
	cancel: (handle: number): void => {
		window.clearTimeout(handle);
	},
};

/**
 * Subscribes to the EmailLog SSE stream.
 *
 * Every frame is a "something changed" signal: the hook invalidates the
 * email-log list queries, which refetch through the normal schema-validated
 * pipeline, so rows update the instant a webhook flips a status. Cookies are
 * the only auth transport SSE supports (EventSource cannot set headers),
 * hence `withCredentials: true`. When the stream is closed for good — the
 * access token expired (401) or the API failed — `ReconnectingEventStream`
 * refreshes the session and reconnects with backoff; it only reports
 * `closed` once the session itself is over.
 *
 * @returns The connection state for the "Live" pill.
 */
export function useEmailLogLive(): LiveState {
	const queryClient = useQueryClient();
	const { refreshSession } = useAuthCommands();
	const [state, setState] = useState<LiveState>("connecting");

	useEffect(() => {
		const stream = new ReconnectingEventStream({
			openSource: (): EventSource => new EventSource(emailLogEventsUrl(), { withCredentials: true }),
			refreshSession,
			scheduler: BROWSER_SCHEDULER,
			backoff: DEFAULT_RECONNECT_BACKOFF,
			onMessage: (): void => {
				// Every cached email-log page, whatever its filters/sort/page.
				void queryClient.invalidateQueries({ queryKey: apiRouter.email.logList.scopeKey(undefined) });
			},
			onStateChange: setState,
		});
		stream.start();
		return (): void => {
			stream.stop();
		};
	}, [queryClient, refreshSession]);

	return state;
}
