"use client";

import {
	InAppNotificationListQuerySchema,
	PLATFORM_DISPLAY_REGION,
	type DisplayRegion,
	type InAppNotificationListQuery,
	type InAppNotificationResponse,
} from "@workspace/shared";
import { AppShellNotificationBell } from "@workspace/ui/components/app-shell-notification-bell";
import { Button } from "@workspace/ui/components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { RelativeTime } from "@workspace/ui/components/relative-time";
import { cn } from "@workspace/ui/lib/core/utils";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, type JSX, type MouseEvent } from "react";

import { useAuth, useAuthClientType } from "../../contexts/identity";
import { NOTIFICATIONS_DROPDOWN_LABELS, type NotificationsDropdownLabels } from "./notifications-dropdown-labels";
import { NOTIFICATION_SURFACE_OF_CLIENT } from "./notification-surface";
import { notificationsPollInterval, useNotificationsLive } from "./use-notifications-live";
import { useOpenNotification } from "./use-open-notification";

/** How many of the newest notifications the dropdown previews. */
export const NOTIFICATIONS_PREVIEW_LIMIT = 4;

export interface NotificationsDropdownProps {
	/** Where "View all notifications" leads; the button is not shown without one. */
	readonly viewAllHref?: string | undefined;
	/** Locale and time zone the notification times are shown in. */
	readonly region?: DisplayRegion;
	readonly labels?: NotificationsDropdownLabels;
}

/**
 * The app shell's notification bell for the signed-in person (ADR 070): the newest notifications of THIS
 * app's inbox (`GET /notifications?surface=…`, archived ones left out) and its unread count
 * (`GET /notifications/unread-count`). Both refresh the moment the live stream signals a change, and every
 * minute while it is down. Opening one marks it read and follows its link.
 */
export function NotificationsDropdown({ viewAllHref, region = PLATFORM_DISPLAY_REGION, labels = NOTIFICATIONS_DROPDOWN_LABELS }: NotificationsDropdownProps): JSX.Element {
	const { api } = useAuth();
	const surface = NOTIFICATION_SURFACE_OF_CLIENT[useAuthClientType()];
	const liveState = useNotificationsLive(surface);
	const previewQuery = useMemo(
		(): InAppNotificationListQuery => InAppNotificationListQuerySchema.parse({ surface, limit: NOTIFICATIONS_PREVIEW_LIMIT, filter: { archivedAt: { isNull: true } } }),
		[surface],
	);
	const listQuery = api.notifications.inbox.useQuery(previewQuery);
	const unreadQuery = api.notifications.unreadCount.useQuery({ surface }, { refetchInterval: notificationsPollInterval(liveState) });
	const openNotification = useOpenNotification(surface);
	const notifications = useMemo((): readonly InAppNotificationResponse[] => listQuery.data?.data ?? [], [listQuery.data]);
	const unreadCount = unreadQuery.data?.data.unread ?? 0;

	const handleNotificationClick = useCallback(
		(event: MouseEvent<HTMLButtonElement>): void => {
			const notificationId = event.currentTarget.dataset.notificationId;
			const notification = notifications.find((candidate: InAppNotificationResponse): boolean => candidate.id === notificationId);
			if (notification !== undefined) {
				openNotification(notification);
			}
		},
		[notifications, openNotification],
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
				<div className="max-h-64 overflow-x-hidden overflow-y-auto">
					{listQuery.isError ? <p className="px-4 py-3 text-sm text-muted-foreground">{labels.loadError}</p> : null}
					{!listQuery.isError && !listQuery.isPending && notifications.length === 0 ? <p className="px-4 py-3 text-sm text-muted-foreground">{labels.empty}</p> : null}
					{notifications.map((notification: InAppNotificationResponse) => {
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
									"h-auto min-w-0 flex-col items-start gap-1 rounded-none border-b border-border/60 px-4 py-3 text-start whitespace-normal transition-colors last:border-b-0 hover:bg-muted/60",
									!read ? "bg-primary/[0.04]" : undefined,
								)}>
								<div className="flex w-full min-w-0 items-start justify-between gap-2">
									<span className="line-clamp-2 min-w-0 flex-1 text-sm font-medium wrap-anywhere text-foreground">{notification.title}</span>
									{!read ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" /> : null}
								</div>
								{notification.senderName === null ? null : <span className="text-xs font-medium text-muted-foreground">{notification.senderName}</span>}
								<p className="line-clamp-2 w-full text-xs wrap-anywhere text-muted-foreground">{notification.body}</p>
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
