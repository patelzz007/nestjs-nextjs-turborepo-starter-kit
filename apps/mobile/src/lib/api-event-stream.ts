// ============================================
// lib/api-event-stream.ts - One of the API's SSE streams, signed in
// ============================================
// Opens `path` on the API (lib/server-events.ts) with the session's bearer
// token over `expo/fetch`, which streams a response body (React Native's own
// fetch cannot). A 401 renews the session the way any request does — an
// authenticated read — and a session that cannot be renewed stops the stream.

import { buildUrl } from "@workspace/api-client";
import { fetch as expoFetch } from "expo/fetch";

import type { ReadyAppRuntime } from "../runtime/app-runtime";
import type { MobileApiClient } from "./api";
import { openServerEventStream, type ServerEvent, type ServerEventStream, type ServerEventStreamState, type StreamingFetch } from "./server-events";

/** `expo/fetch`, which streams a response body. */
const streamingFetch: StreamingFetch = (url, init) => expoFetch(url, { headers: init.headers, signal: init.signal });

export interface ApiEventStreamOptions {
	readonly runtime: ReadyAppRuntime;
	readonly api: MobileApiClient["api"];
	/** The stream's path and query (`/notifications/stream?surface=CUSTOMER`). */
	readonly path: string;
	readonly onEvent: (event: ServerEvent) => void;
	readonly onState: (state: ServerEventStreamState) => void;
}

export function openApiEventStream({ runtime, api, path, onEvent, onState }: ApiEventStreamOptions): ServerEventStream {
	return openServerEventStream({
		url: buildUrl(runtime.env.apiBaseUrl, path),
		fetch: streamingFetch,
		getAccessToken: () => runtime.tokenProvider.getAccessToken(),
		// Any authenticated read renews an expired access token; one that cannot be renewed ends the session.
		refreshSession: async (): Promise<boolean> => {
			try {
				await api.auth.me.fetchOrThrow(undefined);
				return true;
			} catch {
				return false;
			}
		},
		onEvent,
		onState,
	});
}
