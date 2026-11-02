"use client";

import { cn } from "@workspace/ui/lib/core/utils";
import { Bell } from "lucide-react";
import * as React from "react";

/** The largest count shown as a number; more reads "99+" so the pill keeps its size. */
export const NOTIFICATION_BADGE_MAX = 99;

/** What the badge says: the count, or the most and a plus past it. */
export function notificationBadgeText(count: number, max: number = NOTIFICATION_BADGE_MAX): string {
	return count > max ? `${String(max)}+` : String(count);
}

export interface AppShellNotificationBellProps {
	readonly unreadCount: number;
	readonly className?: string;
}

/**
 * Bell icon with the unread count pinned to the trigger's top-right corner
 * ("3", "99+"; nothing at zero). Decorative: the trigger's accessible name
 * says the count. Renders inside the app's (positioned) trigger button, so it
 * has no wrapper of its own: the ref reaches the bell `<svg>`.
 */
export const AppShellNotificationBell = React.forwardRef<SVGSVGElement, AppShellNotificationBellProps>(function AppShellNotificationBell(
	{ unreadCount, className },
	ref,
): React.JSX.Element {
	const showBadge = unreadCount > 0;

	return (
		<>
			<Bell ref={ref} data-slot="app-shell-notification-bell" className={cn("size-5 text-muted-foreground", className)} aria-hidden="true" />
			{showBadge ? (
				<span
					data-slot="app-shell-notification-badge"
					className="pointer-events-none absolute -top-0.5 -right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-status-foreground tabular-nums ring-2 ring-background"
					aria-hidden="true">
					{notificationBadgeText(unreadCount)}
				</span>
			) : null}
		</>
	);
});
