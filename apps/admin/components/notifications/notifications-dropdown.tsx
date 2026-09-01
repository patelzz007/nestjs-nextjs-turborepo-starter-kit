"use client";

import { Button } from "@workspace/ui/components/form/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@workspace/ui/components/overlay/dropdown-menu";
import { Bell } from "lucide-react";
import * as React from "react";

import { NotificationsList } from "@/components/notifications/notifications-list";
import { notificationsData, type NotificationItem } from "@/lib/notifications";

/**
 * Smart wrapper around the topbar notification bell.
 *
 * Per rules 9–11 this component **owns the data**: it loads the (schema-validated)
 * notification list, tracks read/dismissed state, and hands both the data and the
 * mutation callbacks to the dumb `NotificationsList` via props. It also owns the
 * dropdown's open/close state so "View all" can close the menu programmatically.
 *
 * Note: this deliberately avoids `DropdownMenuLabel`. In Base UI that maps to
 * `Menu.GroupLabel`, which must live inside a `Menu.Group` — rendering it outside
 * one throws "MenuGroupContext is missing". The list below is plain content, which
 * is fully supported inside the popup.
 */
export function NotificationsDropdown(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const [notifications, setNotifications] = React.useState<NotificationItem[]>(notificationsData.notifications);

	const handleMarkAllRead = React.useCallback((): void => {
		setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
	}, []);

	const handleMarkRead = React.useCallback((id: string): void => {
		setNotifications((prev) => prev.map((notification) => (notification.id === id ? { ...notification, read: true } : notification)));
	}, []);

	const handleDismiss = React.useCallback((id: string): void => {
		setNotifications((prev) => prev.filter((notification) => notification.id !== id));
	}, []);

	// There is no dedicated notifications page yet — "View all" just closes the
	// menu. Wire a `router.push("/notifications")` here once that page exists.
	const handleViewAll = React.useCallback((): void => {
		setOpen(false);
	}, []);

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full" />} aria-label="Notifications">
				<Bell className="size-5 text-muted-foreground" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" sideOffset={8} className="w-80 overflow-hidden p-0">
				<NotificationsList notifications={notifications} onMarkAllRead={handleMarkAllRead} onMarkRead={handleMarkRead} onDismiss={handleDismiss} onViewAll={handleViewAll} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
