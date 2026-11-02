// The app's inbox (ADR 070, the CUSTOMER surface), shown as a feed (notifications-feed.tsx): every
// notice or only the unread, newest first, a page more on "See earlier notifications". Reading,
// removing (archiving) and reporting go to the API; the list and the bell's count reload after each,
// and the moment the live stream says the inbox changed (use-unread-notifications.ts).

import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { apiRouter } from "@workspace/api-client";
import { ApiPaginatedMetaSchema, type ApiResponseMeta, type BroadcastReportReason, type InAppNotificationResponse } from "@workspace/shared";
import { useRouter } from "expo-router";
import * as React from "react";

import { useToast } from "../../features/toast/facade";
import { useApi } from "../../lib/api-context";
import { ROUTES } from "../../runtime/routes";
import type { InboxFilter } from "./feed-model";
import { INBOX_MAX_LIMIT, INBOX_PAGE_SIZE, inboxQueryOf, NOTIFICATIONS_SURFACE } from "./inbox-query";
import { NOTIFICATIONS_COPY } from "./labels";
import { NotificationsFeed, type NotificationsFeedState } from "./notifications-feed";

const INBOX_SCOPE = apiRouter.notifications.inbox.scopeKey(undefined);

export function NotificationsInbox(): React.JSX.Element {
	const api = useApi();
	const queryClient = useQueryClient();
	const toast = useToast();
	const router = useRouter();
	const [filter, setFilter] = React.useState<InboxFilter>("all");
	const [pages, setPages] = React.useState(1);
	// A longer list keeps the one shown while it loads; a new filter starts afresh.
	const inbox = api.notifications.inbox.useQuery(inboxQueryOf(filter, pages), pages > 1 ? { placeholderData: keepPreviousData } : {});
	const unread = api.notifications.unreadCount.useQuery({ surface: NOTIFICATIONS_SURFACE });
	const markRead = api.notifications.read.useMutation();
	const archive = api.notifications.archive.useMutation();
	const report = api.notifications.reportBroadcast.useMutation();

	const refresh = React.useCallback((): void => {
		void queryClient.invalidateQueries({ queryKey: INBOX_SCOPE });
	}, [queryClient]);
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
			state={feedStateOf(inbox.data, inbox.isError, pages)}
			filter={filter}
			onFilterChange={changeFilter}
			unreadCount={unread.data?.data.unread ?? 0}
			busy={markRead.isPending || archive.isPending || report.isPending}
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

interface InboxPage {
	readonly data: readonly InAppNotificationResponse[];
	readonly meta: ApiResponseMeta;
}

/** The feed's state from the inbox's answer: more pages while the API has them and the list may still grow. */
function feedStateOf(page: InboxPage | undefined, failed: boolean, pages: number): NotificationsFeedState {
	if (page === undefined) {
		return failed ? { kind: "error" } : { kind: "loading" };
	}
	const hasNext = ApiPaginatedMetaSchema.safeParse(page.meta).data?.hasNext ?? false;
	return { kind: "ready", notifications: page.data, hasMore: hasNext && pages * INBOX_PAGE_SIZE < INBOX_MAX_LIMIT };
}
