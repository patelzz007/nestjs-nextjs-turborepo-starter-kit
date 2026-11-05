// The app's inbox (ADR 070, the CUSTOMER surface), shown as a feed (notifications-feed.tsx): every
// notice or only the unread, newest first, a page more on "See earlier notifications". Reading,
// removing (archiving) and reporting go to the API; the list and the bell's count reload after each,
// and the moment the live stream says the inbox changed (use-unread-notifications.ts). Offline, the list
// loaded last stays readable from memory, marked as possibly out of date (inbox-state.ts, enhancement 6.4),
// and the list and the count reload when the connection comes back (TanStack Query can't see the phone's
// connection on its own, so nothing else would).

import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/api-client";
import type { BroadcastReportReason, InAppNotificationResponse } from "@workspace/shared";
import { useRouter } from "expo-router";
import * as React from "react";

import { useConnectivity } from "../../features/app-status/facade";
import { useToast } from "../../features/toast/facade";
import { useApi } from "../../lib/api-context";
import { useRisingEdge } from "../../lib/use-rising-edge";
import { ROUTES } from "../../runtime/routes";
import type { InboxFilter } from "./feed-model";
import { inboxQueryOf, NOTIFICATIONS_SURFACE } from "./inbox-query";
import { feedStateOf } from "./inbox-state";
import { NOTIFICATIONS_COPY } from "./labels";
import { NotificationsFeed } from "./notifications-feed";

const INBOX_SCOPE = apiRouter.notifications.inbox.scopeKey(undefined);

export function NotificationsInbox(): React.JSX.Element {
	const api = useApi();
	const queryClient = useQueryClient();
	const toast = useToast();
	const router = useRouter();
	const [filter, setFilter] = React.useState<InboxFilter>("all");
	const [pages, setPages] = React.useState(1);
	const offline = useConnectivity() === "offline";
	// A longer list keeps the one shown while it loads; a new filter starts afresh.
	const inbox = api.notifications.inbox.useQuery(inboxQueryOf(filter, pages), pages > 1 ? { placeholderData: keepPreviousData } : {});
	const unread = api.notifications.unreadCount.useQuery({ surface: NOTIFICATIONS_SURFACE });
	const markRead = api.notifications.read.useMutation();
	const archive = api.notifications.archive.useMutation();
	const report = api.notifications.reportBroadcast.useMutation();

	const refresh = React.useCallback((): void => {
		void queryClient.invalidateQueries({ queryKey: INBOX_SCOPE });
	}, [queryClient]);
	useRisingEdge(!offline, refresh);
	const changeFilter = React.useCallback((next: InboxFilter): void => {
		setFilter(next);
		setPages(1);
	}, []);
	const loadMore = React.useCallback((): void => {
		setPages((current) => current + 1);
	}, []);
	const { mutate: markReadMutate } = markRead;
	const { mutate: archiveMutate } = archive;
	const { mutate: reportMutate } = report;
	const handleRead = React.useCallback(
		(notification: InAppNotificationResponse): void => {
			markReadMutate({ surface: NOTIFICATIONS_SURFACE, notificationIds: [notification.id] }, { onSuccess: refresh });
		},
		[markReadMutate, refresh],
	);
	const handleReadAll = React.useCallback((): void => {
		markReadMutate({ surface: NOTIFICATIONS_SURFACE, markAll: true }, { onSuccess: refresh });
	}, [markReadMutate, refresh]);
	const handleRemove = React.useCallback(
		(notification: InAppNotificationResponse): void => {
			archiveMutate(
				{ notificationIds: [notification.id] },
				{
					onSuccess: (): void => {
						refresh();
						toast.success(NOTIFICATIONS_COPY.removed);
					},
				},
			);
		},
		[archiveMutate, refresh, toast],
	);
	const handleReport = React.useCallback(
		(notification: InAppNotificationResponse, reason: BroadcastReportReason): void => {
			if (notification.broadcastId === null) {
				return;
			}
			reportMutate(
				{ broadcastId: notification.broadcastId, reason, note: null },
				{
					onSuccess: (): void => {
						toast.success(NOTIFICATIONS_COPY.reported);
					},
				},
			);
		},
		[reportMutate, toast],
	);
	const openSettings = React.useCallback((): void => {
		router.push(ROUTES.notificationSettings);
	}, [router]);

	return (
		<NotificationsFeed
			state={feedStateOf({ page: inbox.data, failed: inbox.isError, offline, pages })}
			filter={filter}
			onFilterChange={changeFilter}
			unreadCount={unread.data?.data.unread ?? 0}
			busy={markRead.isPending || archive.isPending || report.isPending}
			offline={offline}
			loadingMore={inbox.isPlaceholderData}
			onLoadMore={loadMore}
			onRetry={refresh}
			onRead={handleRead}
			onReadAll={handleReadAll}
			onRemove={handleRemove}
			onReport={handleReport}
			onOpenSettings={openSettings}
		/>
	);
}
