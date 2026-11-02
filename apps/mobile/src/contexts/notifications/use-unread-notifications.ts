// The header bell's unread count (ADR 070), live: `GET /notifications/unread-count` for this app's
// inbox, and — while the app is in the foreground — the inbox's change stream
// (`GET /notifications/stream`, SSE). Every frame reloads the inbox and the count, so a notice shows
// up the moment it is written, on the bell and on the inbox screen alike. While the stream is not
// open (connecting, reconnecting, or the app in the background) the count is asked for every
// minute instead; a stream that opens again — after a drop, or the app coming back to the
// foreground — reloads once, for what it missed.

import { useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/api-client";
import { apiRoutes } from "@workspace/shared";
import * as React from "react";

import { openApiEventStream } from "../../lib/api-event-stream";
import { useApi } from "../../lib/api-context";
import { useAppActive } from "../../lib/use-app-active";
import type { ServerEvent, ServerEventStreamState } from "../../lib/server-events";
import { useReadyRuntime } from "../../runtime/runtime-context";
import { NOTIFICATIONS_SURFACE } from "./inbox-query";

/** While the live stream is down, the bell asks every minute instead (the web apps' interval). */
export const NOTIFICATIONS_POLL_INTERVAL_MS = 60_000;

/** The inbox and its unread count: the count's scope is nested under the inbox's. */
const INBOX_SCOPE = apiRouter.notifications.inbox.scopeKey(undefined);

const STREAM_PATH = `${apiRoutes.notifications.stream}?surface=${NOTIFICATIONS_SURFACE}`;

/** How many of this app's notifications are unread; 0 until the first answer. */
export function useUnreadNotifications(): number {
	const api = useApi();
	const runtime = useReadyRuntime();
	const queryClient = useQueryClient();
	const active = useAppActive();
	const [connection, setConnection] = React.useState<ServerEventStreamState>("connecting");
	/** A stream opened before: the next one to open may have missed changes. */
	const hasOpened = React.useRef(false);
	const live = active && connection === "open";
	const unread = api.notifications.unreadCount.useQuery({ surface: NOTIFICATIONS_SURFACE }, { refetchInterval: live ? false : NOTIFICATIONS_POLL_INTERVAL_MS });

	React.useEffect((): (() => void) | undefined => {
		if (!active) {
			return undefined;
		}
		const reload = (): void => {
			void queryClient.invalidateQueries({ queryKey: INBOX_SCOPE });
		};
		const stream = openApiEventStream({
			runtime,
			api,
			path: STREAM_PATH,
			onEvent: (event: ServerEvent): void => {
				// `ping` frames only keep the connection open.
				if (event.type === "message") {
					reload();
				}
			},
			onState: (state: ServerEventStreamState): void => {
				if (state === "open") {
					if (hasOpened.current) {
						reload();
					}
					hasOpened.current = true;
				}
				setConnection(state);
			},
		});
		return (): void => {
			stream.close();
		};
	}, [active, api, queryClient, runtime]);

	return unread.data?.data.unread ?? 0;
}
