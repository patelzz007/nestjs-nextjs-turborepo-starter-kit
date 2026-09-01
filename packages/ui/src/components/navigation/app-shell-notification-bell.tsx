"use client";

import { cn } from "@workspace/ui/lib/utils";
import { Bell } from "lucide-react";
import * as React from "react";

export interface AppShellNotificationBellProps {
	readonly unreadCount: number;
	readonly className?: string;
}

/** Bell icon with an unread indicator pinned to the trigger's top-right corner. */
export function AppShellNotificationBell({ unreadCount, className }: AppShellNotificationBellProps): React.JSX.Element {
	const showBadge = unreadCount > 0;

	return (
		<>
			<Bell className={cn("size-5 text-muted-foreground", className)} aria-hidden="true" />
			{showBadge ? (
				<span className="pointer-events-none absolute top-1.5 right-1.5 block size-2 rounded-full bg-destructive ring-2 ring-background" aria-hidden="true" />
			) : null}
		</>
	);
}
