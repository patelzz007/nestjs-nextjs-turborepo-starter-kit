"use client";

import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

export interface PanelSidebarHeaderProps extends Omit<React.ComponentProps<"div">, "title"> {
	readonly title: string;
	readonly subtitle?: string;
	readonly icon: React.ReactNode;
	readonly className?: string;
}

/** Compact sidebar header — matches admin panel chrome. */
export const PanelSidebarHeader = React.forwardRef<HTMLDivElement, PanelSidebarHeaderProps>(function PanelSidebarHeader(
	{ title, subtitle, icon, className, ...props },
	ref,
): React.JSX.Element {
	return (
		<div
			ref={ref}
			data-slot="panel-sidebar-header"
			className={cn("panel-shell-sidebar-header flex h-16 shrink-0 items-center border-b border-sidebar-border px-2", className)}
			{...props}>
			<div className="flex h-full min-w-0 items-center gap-3">
				<div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sidebar-accent shadow-xs ring-1 ring-sidebar-border/40">{icon}</div>
				<div className="min-w-0 flex-1">
					<span className="block truncate text-sm font-semibold text-sidebar-foreground">{title}</span>
					{subtitle !== undefined ? <span className="block truncate text-xs text-muted-foreground">{subtitle}</span> : null}
				</div>
			</div>
		</div>
	);
});
