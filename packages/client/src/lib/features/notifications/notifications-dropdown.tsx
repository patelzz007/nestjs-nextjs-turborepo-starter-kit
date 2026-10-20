"use client";

import { useQueryClient } from "@tanstack/react-query";
import { PLATFORM_DISPLAY_REGION, RewardNotificationListQuerySchema, type DisplayRegion, type RewardNotificationListQuery } from "@workspace/shared";
import { AppShellNotificationBell } from "@workspace/ui/components/app-shell-notification-bell";
import { Button } from "@workspace/ui/components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { RelativeTime } from "@workspace/ui/components/relative-time";
import { cn } from "@workspace/ui/lib/core/utils";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, type JSX, type MouseEvent } from "react";

import { readPaginatedTotal } from "../../api/envelope";
import { apiRouter } from "../../api/endpoints";
import { useAuth } from "../../contexts/identity";
import { NOTIFICATIONS_DROPDOWN_LABELS, type NotificationsDropdownLabels } from "./notifications-dropdown-labels";

/** How many of the newest notifications the dropdown previews. */
export const NOTIFICATIONS_PREVIEW_LIMIT = 4;

/** The newest notifications, newest first (the list's default sort). */
const PREVIEW_QUERY: RewardNotificationListQuery = RewardNotificationListQuerySchema.parse({ limit: NOTIFICATIONS_PREVIEW_LIMIT });

/** The smallest page of the unread ones: the badge reads its `meta.total`, never the rows. */
const UNREAD_COUNT_PAGE_SIZE = 1;
const UNREAD_COUNT_QUERY: RewardNotificationListQuery = RewardNotificationListQuerySchema.parse({ limit: UNREAD_COUNT_PAGE_SIZE, filter: { readAt: { isNull: true } } });

export interface NotificationsDropdownProps {
	/** Where "View all notifications" leads; the button is not shown without one. */
	readonly viewAllHref?: string | undefined;
	/** Locale and time zone the notification times are shown in. */
	readonly region?: DisplayRegion;
	readonly labels?: NotificationsDropdownLabels;
}

/**
 * The app shell's notification bell for the signed-in user (any app): their newest in-app notifications
 * and how many are unread — both read from `GET /reward-notifications` (the count is the unread filter's
 * `meta.total`). Opening one marks it read
 * (`POST /reward-notifications/read`). Times arrive as epoch milliseconds and are only formatted here.
 */
export function NotificationsDropdown({ viewAllHref, region = PLATFORM_DISPLAY_REGION, labels = NOTIFICATIONS_DROPDOWN_LABELS }: NotificationsDropdownProps): JSX.Element {
	const { api } = useAuth();
	const queryClient = useQueryClient();
	const listQuery = api.rewardNotifications.list.useQuery(PREVIEW_QUERY);
	const unreadQuery = api.rewardNotifications.list.useQuery(UNREAD_COUNT_QUERY);
	const markRead = api.rewardNotifications.read.useMutation();
	const notifications = listQuery.data?.data ?? [];
	const unreadCount = unreadQuery.data === undefined ? 0 : readPaginatedTotal(unreadQuery.data.meta, unreadQuery.data.data.length);

	const handleNotificationClick = useCallback(
		(event: MouseEvent<HTMLButtonElement>): void => {
			const notificationId = event.currentTarget.dataset.notificationId;
			if (notificationId === undefined || event.currentTarget.dataset.read === "true") {
				return;
			}
			markRead.mutate(
				{ notificationIds: [notificationId] },
				// The scope covers the preview and the unread count alike.
				{ onSuccess: (): void => void queryClient.invalidateQueries({ queryKey: apiRouter.rewardNotifications.list.scopeKey(PREVIEW_QUERY) }) },
			);
		},
		[markRead, queryClient],
	);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="relative rounded-full" aria-label={labels.trigger(unreadCount)} />}>
				<AppShellNotificationBell unreadCount={unreadCount} />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-80 overflow-hidden p-0">
				<div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
					<div className="flex min-w-0 items-center gap-2">
						<Bell className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
						<h3 className="truncate text-sm font-semibold text-foreground">{labels.title}</h3>
						{unreadCount > 0 ? (
							<span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">{labels.unreadBadge(unreadCount)}</span>
						) : null}
					</div>
				</div>
				<div className="max-h-64 overflow-y-auto">
					{listQuery.isError ? <p className="px-4 py-3 text-sm text-muted-foreground">{labels.loadError}</p> : null}
					{!listQuery.isError && !listQuery.isPending && notifications.length === 0 ? <p className="px-4 py-3 text-sm text-muted-foreground">{labels.empty}</p> : null}
					{notifications.map((notification) => {
						const read = notification.readAt !== null;
						return (
							<Button
								key={notification.id}
								type="button"
								variant="nav"
								data-notification-id={notification.id}
								data-read={String(read)}
								onClick={handleNotificationClick}
								className={cn(
									"h-auto flex-col items-start gap-1 rounded-none border-b border-border/60 px-4 py-3 text-start transition-colors last:border-b-0 hover:bg-muted/60",
									!read ? "bg-primary/[0.04]" : undefined,
								)}>
								<div className="flex w-full items-center justify-between gap-2">
									<span className="text-sm font-medium text-foreground">{notification.title}</span>
									{!read ? <span className="size-2 shrink-0 rounded-full bg-primary" /> : null}
								</div>
								<p className="line-clamp-2 text-xs text-muted-foreground">{notification.body}</p>
								<RelativeTime epochMs={notification.createdAt} region={region} className="text-xs text-muted-foreground/70" />
							</Button>
						);
					})}
				</div>
				{viewAllHref !== undefined ? (
					<div className="border-t border-border p-2">
						<Button variant="outline" size="sm" className="w-full" nativeButton={false} render={<Link href={viewAllHref} />}>
							{labels.viewAll}
						</Button>
					</div>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
