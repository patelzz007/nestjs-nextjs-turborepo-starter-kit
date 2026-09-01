"use client";

import { MERCHANT_NOTIFICATIONS_DATA, type MerchantNotificationItem } from "@/lib/notifications";
import { Button } from "@workspace/ui/components/form/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@workspace/ui/components/overlay/dropdown-menu";
import { AppShellNotificationBell } from "@workspace/ui/components/navigation/app-shell-notification-bell";
import { cn } from "@workspace/ui/lib/utils";
import { Bell } from "lucide-react";
import * as React from "react";

export function MerchantNotificationsDropdown(): React.JSX.Element {
	const [notifications, setNotifications] = React.useState<readonly MerchantNotificationItem[]>(MERCHANT_NOTIFICATIONS_DATA.notifications);

	const unreadCount = notifications.filter((notification) => !notification.read).length;

	const handleMarkRead = React.useCallback((id: string): void => {
		setNotifications((previous) => previous.map((notification) => (notification.id === id ? { ...notification, read: true } : notification)));
	}, []);

	const handleNotificationClick = React.useCallback(
		(event: React.MouseEvent<HTMLButtonElement>): void => {
			const notificationId = event.currentTarget.dataset.notificationId;
			if (notificationId !== undefined) {
				handleMarkRead(notificationId);
			}
		},
		[handleMarkRead],
	);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button variant="ghost" size="icon" className="relative rounded-full" aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"} />
				}>
				<AppShellNotificationBell unreadCount={unreadCount} />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-80 overflow-hidden p-0">
				<div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
					<div className="flex min-w-0 items-center gap-2">
						<Bell className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
						<h3 className="truncate text-sm font-semibold text-foreground">Notifications</h3>
						{unreadCount > 0 ? <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">{unreadCount} new</span> : null}
					</div>
				</div>
				<div className="max-h-64 overflow-y-auto">
					{notifications.slice(0, 4).map((notification) => (
						<Button
							key={notification.id}
							type="button"
							variant="nav"
							data-notification-id={notification.id}
							onClick={handleNotificationClick}
							className={cn(
								"h-auto flex-col items-start gap-1 rounded-none border-b border-border/60 px-4 py-3 text-start transition-colors last:border-b-0 hover:bg-muted/60",
								!notification.read ? "bg-primary/[0.04]" : undefined,
							)}>
							<div className="flex w-full items-center justify-between gap-2">
								<span className="text-sm font-medium text-foreground">{notification.title}</span>
								{!notification.read ? <span className="size-2 shrink-0 rounded-full bg-primary" /> : null}
							</div>
							<p className="line-clamp-2 text-xs text-muted-foreground">{notification.message}</p>
							<span className="text-xs text-muted-foreground/70">{notification.time}</span>
						</Button>
					))}
				</div>
				<div className="border-t border-border p-2">
					<Button type="button" variant="outline" size="sm" className="w-full">
						View all notifications
					</Button>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
