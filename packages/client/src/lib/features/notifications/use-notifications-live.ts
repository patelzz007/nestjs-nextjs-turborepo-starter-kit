"use client";

import { apiRoutes, type NotificationSurface } from "@workspace/shared";
import { useMemo } from "react";

import { apiRouter } from "../../api/endpoints";
import { useAuthClientType } from "../../contexts/identity";
import { liveEventsUrl, useLiveQueryInvalidation } from "../live-updates/live-query-invalidation";
import type { LiveState } from "../live-updates/reconnecting-event-stream";

/** While the live stream is down, the bell asks every minute instead (ADR 070). */
export const NOTIFICATIONS_POLL_INTERVAL_MS = 60_000;

/** The inbox and its unread count (the count's scope is nested under the inbox's). */
const INBOX_SCOPE = apiRouter.notifications.inbox.scopeKey(undefined);

/**
 * Subscribes to the caller's inbox on one surface (`GET /notifications/stream`, SSE): every frame refetches
 * the inbox and the unread count, so a notification shows up the moment it is written.
 *
 * @returns The connection state; anything but `open` means the caller should poll.
 */
export function useNotificationsLive(surface: NotificationSurface): LiveState {
	const clientType = useAuthClientType();
	const url = useMemo((): string => liveEventsUrl(apiRoutes.notifications.stream, clientType, { surface }), [clientType, surface]);
	return useLiveQueryInvalidation({ url, queryKey: INBOX_SCOPE });
}

/** The unread count's refetch interval: none while the stream is live, a minute otherwise. */
export function notificationsPollInterval(state: LiveState): number | false {
	return state === "open" ? false : NOTIFICATIONS_POLL_INTERVAL_MS;
}
