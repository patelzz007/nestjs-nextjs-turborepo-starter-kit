"use client";

import { PanelShellContent } from "@workspace/ui/components/navigation/panel-shell-content";
import { Sidebar, SidebarInset, SidebarProvider } from "@workspace/ui/components/navigation/sidebar";
import { DEFAULT_SIDEBAR_LABELS } from "@workspace/ui/lib/sidebar-labels";
import { createNoopSidebarStorage } from "@workspace/ui/lib/sidebar-storage";
import { cn } from "@workspace/ui/lib/utils";
import * as React from "react";

const PANEL_SIDEBAR_STORAGE = createNoopSidebarStorage();

export interface AppPanelShellProps {
	readonly banner?: React.ReactNode;
	readonly shellClassName?: string;
	readonly sidebar: React.ReactNode;
	readonly topbar: React.ReactNode;
	readonly children: React.ReactNode;
	readonly sidebarClassName?: string;
	readonly contentClassName?: string;
	readonly mainClassName?: string;
	readonly sidebarOpen?: boolean;
	readonly onSidebarOpenChange?: (open: boolean) => void;
	readonly sidebarBadges?: Readonly<Record<string, string | number>>;
}

/**
 * Shared panel chrome for web + merchant: offcanvas desktop rail (same animation
 * as admin), mobile sheet drawer, and main inset. Sidebar open/collapse is owned
 * by `SidebarProvider` so ⌘B and the topbar trigger stay in sync.
 */
export function AppPanelShell({
	banner,
	shellClassName,
	sidebar,
	topbar,
	children,
	sidebarClassName,
	contentClassName,
	mainClassName,
	sidebarOpen,
	onSidebarOpenChange,
	sidebarBadges = {},
}: AppPanelShellProps): React.JSX.Element {
	const isControlledSidebar = sidebarOpen !== undefined;

	return (
		<div className={cn("min-h-svh text-foreground", shellClassName)}>
			<SidebarProvider
				defaultOpen={sidebarOpen ?? true}
				open={isControlledSidebar ? sidebarOpen : undefined}
				onOpenChange={isControlledSidebar ? onSidebarOpenChange : undefined}
				labels={DEFAULT_SIDEBAR_LABELS}
				storage={PANEL_SIDEBAR_STORAGE}
				badges={sidebarBadges}>
				<Sidebar collapsible="offcanvas" className={cn("panel-shell-sidebar border-e border-sidebar-border bg-card", sidebarClassName)}>
					{sidebar}
				</Sidebar>
				<SidebarInset className={cn("flex h-svh min-w-0 flex-col overflow-hidden bg-background")}>
					{banner}
					{topbar}
					<main id="main-content" tabIndex={-1} className={cn("min-h-0 flex-1 overflow-y-auto overscroll-none outline-none", mainClassName)}>
						<PanelShellContent className={contentClassName}>{children}</PanelShellContent>
					</main>
				</SidebarInset>
			</SidebarProvider>
		</div>
	);
}
