// ============================================
// @workspace/client/lib/features/live-updates/live-query-invalidation.ts - keep queries fresh from an SSE stream
// ============================================
"use client";

import type { QueryKey } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { CLIENT_TYPE_QUERY_PARAM, type AuthClientType } from "@workspace/shared";
import { useEffect, useState } from "react";

import { API_BASE_URL, API_URL_PREFIX } from "../../api/config";
import { useAuthCommands } from "../../contexts/identity";
import { DEFAULT_RECONNECT_BACKOFF, ReconnectingEventStream, type LiveState, type ReconnectScheduler } from "./reconnecting-event-stream";

/**
 * The absolute URL of an API stream route (`apiRoutes.…events`), declaring the
 * app's client type in the query: `EventSource` cannot send `X-Client-Type`,
 * and without it the API reads another app's access-token cookie — every
 * connection then fails with 401, and each reconnect refreshes the session,
 * filling the audit log with auth requests. `params` are the route's own query
 * parameters (e.g. the notification stream's `surface`).
 */
export function liveEventsUrl(route: string, clientType: AuthClientType, params: Readonly<Record<string, string>> = {}): string {
	const url = new URL(`${API_URL_PREFIX}${route}`, API_BASE_URL);
	for (const [name, value] of Object.entries(params)) {
		url.searchParams.set(name, value);
	}
	url.searchParams.set(CLIENT_TYPE_QUERY_PARAM, clientType);
	return url.toString();
}

const BROWSER_SCHEDULER: ReconnectScheduler = {
	schedule: (callback: () => void, delayMs: number): number => window.setTimeout(callback, delayMs),
	cancel: (handle: number): void => {
		window.clearTimeout(handle);
	},
};

export interface LiveQueryInvalidationOptions {
	/** The SSE endpoint ({@link liveEventsUrl}). */
	readonly url: string;
	/**
	 * The query scope to refetch on every frame — every cached page, whatever
	 * its filters, sort or page. Pass a module-level constant: the subscription
	 * reopens whenever the key's identity changes.
	 */
	readonly queryKey: QueryKey;
}

/**
 * Subscribes to an SSE stream of "something changed" signals and refetches a
 * query scope on every frame, so a list updates without a manual refresh —
 * the rows always come through the normal, schema-validated endpoint, never
 * from the stream. Cookies are the only auth transport SSE supports
 * (EventSource cannot set headers), hence `withCredentials: true`. When the
 * stream closes for good (401 once the access token expired, or the API
 * failed), `ReconnectingEventStream` refreshes the session and reconnects with
 * backoff; it reports `closed` only once the session itself is over.
 *
 * @returns The connection state, for a "Live" pill.
 */
export function useLiveQueryInvalidation({ url, queryKey }: LiveQueryInvalidationOptions): LiveState {
	const queryClient = useQueryClient();
	const { refreshSession } = useAuthCommands();
	const [state, setState] = useState<LiveState>("connecting");

	useEffect(() => {
		const stream = new ReconnectingEventStream({
			openSource: (): EventSource => new EventSource(url, { withCredentials: true }),
			refreshSession,
			scheduler: BROWSER_SCHEDULER,
			backoff: DEFAULT_RECONNECT_BACKOFF,
			onMessage: (): void => {
				void queryClient.invalidateQueries({ queryKey });
			},
			onStateChange: setState,
		});
		stream.start();
		return (): void => {
			stream.stop();
		};
	}, [queryClient, queryKey, refreshSession, url]);

	return state;
}
