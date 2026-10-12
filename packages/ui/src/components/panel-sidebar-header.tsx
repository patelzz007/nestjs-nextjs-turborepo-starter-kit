"use client";

import { SidebarTrigger } from "@workspace/ui/components/sidebar";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

export interface PanelSidebarHeaderProps extends Omit<React.ComponentProps<"div">, "title"> {
	readonly title: string;
	readonly subtitle?: string;
	readonly icon: React.ReactNode;
	/** The collapse toggle at the end of the header (the panel header offers it back). Default on. */
	readonly showCollapseToggle?: boolean;
	readonly className?: string;
}

/**
 * The panel sidebar's header (app shell 3) — admin, web and merchant: the
 * brand, and the toggle that collapses the sidebar completely (⌘B too). 56pt,
 * level with the page panel's header, sitting on the frame without a rule.
 */
export const PanelSidebarHeader = React.forwardRef<HTMLDivElement, PanelSidebarHeaderProps>(function PanelSidebarHeader(
	{ title, subtitle, icon, showCollapseToggle = true, className, ...props },
	ref,
): React.JSX.Element {
	return (
		<div ref={ref} data-slot="panel-sidebar-header" className={cn("panel-shell-sidebar-header flex h-14 shrink-0 items-center px-2", className)} {...props}>
			<div className="flex h-full min-w-0 flex-1 items-center gap-3">
				<div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sidebar-accent shadow-xs ring-1 ring-sidebar-border/40">{icon}</div>
				<div className="min-w-0 flex-1">
					<span className="block truncate text-sm font-semibold text-sidebar-foreground" title={title}>
						{title}
					</span>
					{subtitle !== undefined ? <span className="block truncate text-xs text-muted-foreground">{subtitle}</span> : null}
				</div>
				{showCollapseToggle ? <SidebarTrigger className="shrink-0 text-muted-foreground hover:text-sidebar-foreground" /> : null}
			</div>
		</div>
	);
});
