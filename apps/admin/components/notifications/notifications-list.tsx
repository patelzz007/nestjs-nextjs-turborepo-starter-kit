"use client";

import { Button } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/utils";
import { Bell, Check, X } from "lucide-react";
import * as React from "react";

import type { NotificationItem } from "@/lib/notifications";

export interface NotificationsListProps {
	/** The notifications to render. */
	readonly notifications: readonly NotificationItem[];
	/** Marks every notification as read. */
	readonly onMarkAllRead: () => void;
	/** Marks a single notification as read (by id). */
	readonly onMarkRead: (id: string) => void;
	/** Removes a single notification (by id). */
	readonly onDismiss: (id: string) => void;
	/** Invoked when the user clicks "View all notifications". */
	readonly onViewAll: () => void;
}

interface NotificationRowProps {
	readonly notification: NotificationItem;
	readonly onMarkRead: (id: string) => void;
	readonly onDismiss: (id: string) => void;
}

/**
 * A single notification row. It exists (rather than inlining the row markup in a
 * `.map`) so the per-item click handlers can be `useCallback`s that close over
 * the notification id — satisfying `react/jsx-no-bind`, which bans inline arrow
 * functions in JSX props.
 */
function NotificationRow({ notification, onMarkRead, onDismiss }: NotificationRowProps): React.JSX.Element {
	const isUnread = !notification.read;

	const handleMarkRead = React.useCallback((): void => {
		onMarkRead(notification.id);
	}, [notification.id, onMarkRead]);

	const handleDismiss = React.useCallback((): void => {
		onDismiss(notification.id);
	}, [notification.id, onDismiss]);

	return (
		<div
			className={cn(
				"group/notification flex items-start justify-between gap-2 border-b border-border/60 px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/60",
				isUnread ? "bg-primary/[0.04] dark:bg-primary/[0.07]" : undefined,
			)}>
			<div className="min-w-0 flex-1">
				<div className="mb-1 flex items-center gap-2">
					<h4 className="truncate text-sm font-medium text-foreground">{notification.title}</h4>
					{isUnread ? <span className="size-2 shrink-0 rounded-full bg-primary" /> : null}
				</div>
				<p className="mb-1.5 line-clamp-2 text-sm text-muted-foreground">{notification.message}</p>
				<p className="text-xs text-muted-foreground/70">{notification.time}</p>
			</div>

			{/* Per-item actions — always visible on touch, revealed on hover at `sm`+ */}
			<div className="flex shrink-0 items-center gap-0.5 sm:opacity-0 sm:transition-opacity sm:group-focus-within/notification:opacity-100 sm:group-hover/notification:opacity-100">
				{isUnread ? (
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						className="text-muted-foreground hover:text-foreground"
						aria-label={`Mark "${notification.title}" as read`}
						onClick={handleMarkRead}>
						<Check className="size-3.5" />
					</Button>
				) : null}
				<Button
					type="button"
					variant="ghost"
					size="icon-xs"
					className="text-muted-foreground hover:text-destructive"
					aria-label={`Dismiss "${notification.title}"`}
					onClick={handleDismiss}>
					<X className="size-3.5" />
				</Button>
			</div>
		</div>
	);
}

/**
 * Dumb, presentational notification list for the topbar bell dropdown.
 *
 * It knows nothing about where the data comes from or how it is modified — the
 * smart component (`NotificationsDropdown`) owns the state and passes both the
 * data and every mutation callback down through props (rules 9–11). The only
 * logic here is pure view logic: counting unread items and choosing classes.
 */
export function NotificationsList({ notifications, onMarkAllRead, onMarkRead, onDismiss, onViewAll }: NotificationsListProps): React.JSX.Element {
	const unreadCount = notifications.filter((notification) => !notification.read).length;

	return (
		<div className="w-full">
			{/* ── Header ─────────────────────────────────────────────── */}
			<div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
				<div className="flex min-w-0 items-center gap-2">
					<Bell className="size-4 shrink-0 text-muted-foreground" />
					<h3 className="truncate text-sm font-semibold text-foreground">Notifications</h3>
					{unreadCount > 0 ? <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{unreadCount} new</span> : null}
				</div>
				<Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={unreadCount === 0} onClick={onMarkAllRead}>
					Mark all read
				</Button>
			</div>

			{/* ── List ───────────────────────────────────────────────── */}
			<div className="max-h-80 overflow-y-auto">
				{notifications.length === 0 ? (
					<div className="flex flex-col items-center justify-center px-8 py-10 text-center">
						<Bell className="mb-3 size-8 text-muted-foreground/30" />
						<p className="text-sm font-medium text-foreground">No notifications</p>
						<p className="mt-1 text-xs text-muted-foreground">You&apos;re all caught up.</p>
					</div>
				) : (
					notifications.map((notification) => <NotificationRow key={notification.id} notification={notification} onMarkRead={onMarkRead} onDismiss={onDismiss} />)
				)}
			</div>

			{/* ── Footer ─────────────────────────────────────────────── */}
			<div className="border-t border-border p-2">
				<Button type="button" variant="outline" size="sm" className="w-full" onClick={onViewAll}>
					View all notifications
				</Button>
			</div>
		</div>
	);
}
