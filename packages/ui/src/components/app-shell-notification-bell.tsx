"use client";

import { cn } from "@workspace/ui/lib/core/utils";
import { Bell } from "lucide-react";
import * as React from "react";

export interface AppShellNotificationBellProps {
	readonly unreadCount: number;
	readonly className?: string;
}

/**
 * Bell icon with an unread indicator pinned to the trigger's top-right corner.
 * Renders inside the app's (positioned) trigger button, so it has no wrapper
 * of its own: the ref reaches the bell `<svg>`.
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
					className="pointer-events-none absolute top-1.5 right-1.5 block size-2 rounded-full bg-destructive ring-2 ring-background"
					aria-hidden="true"
				/>
			) : null}
		</>
	);
});
