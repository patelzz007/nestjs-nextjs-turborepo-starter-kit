"use client";

import { PanelShellContent } from "@workspace/ui/components/panel-shell-content";
import { Sidebar, SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar";
import { useResetScrollOnChange } from "@workspace/ui/hooks/use-reset-scroll-on-change";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { createNoopSidebarStorage } from "@workspace/ui/lib/sidebar/storage";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

const PANEL_SIDEBAR_STORAGE = createNoopSidebarStorage();

/** Stable empty badge map — a fresh `{}` default per render would defeat the sidebar context's memo. */
const NO_SIDEBAR_BADGES: Readonly<Record<string, string | number>> = {};

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
	/** Per-usage overrides of the `sidebar` family's copy (toggle, mobile sheet) from `UiKitLabelsProvider`. */
	readonly sidebarLabels?: UiKitLabelsOverride<"sidebar">;
	/**
	 * Scrolls the content back to the top when this changes — pass the
	 * pathname. The content scrolls inside `<main>`, not the window, so the
	 * router's own scroll restoration never reaches it. The page is not remounted.
	 */
	readonly scrollResetKey?: string;
}

/**
 * Shared panel chrome for web + merchant (the one implementation — no per-app copies): offcanvas desktop rail (same animation
 * as admin), mobile sheet drawer, and main inset. Sidebar open/collapse is owned
 * by `SidebarProvider` so ⌘B and the topbar trigger stay in sync — controlled
 * with `sidebarOpen` / `onSidebarOpenChange`, or uncontrolled when omitted.
 * The ref reaches the outer shell `<div>`.
 */
export const AppPanelShell = React.forwardRef<HTMLDivElement, AppPanelShellProps>(function AppPanelShell(
	{
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
		sidebarBadges = NO_SIDEBAR_BADGES,
		sidebarLabels,
		scrollResetKey,
	},
	ref,
): React.JSX.Element {
	const isControlledSidebar = sidebarOpen !== undefined;
	const mainRef = React.useRef<HTMLElement>(null);
	useResetScrollOnChange(mainRef, scrollResetKey);

	return (
		<div ref={ref} data-slot="app-panel-shell" className={cn("min-h-svh text-foreground", shellClassName)}>
			<SidebarProvider
				defaultOpen={sidebarOpen ?? true}
				open={isControlledSidebar ? sidebarOpen : undefined}
				onOpenChange={isControlledSidebar ? onSidebarOpenChange : undefined}
				labels={sidebarLabels}
				storage={PANEL_SIDEBAR_STORAGE}
				badges={sidebarBadges}>
				<Sidebar collapsible="offcanvas" className={cn("panel-shell-sidebar border-e border-sidebar-border bg-card", sidebarClassName)}>
					{sidebar}
				</Sidebar>
				<SidebarInset className="flex h-svh min-w-0 flex-col overflow-hidden bg-background">
					{banner}
					{topbar}
					<main ref={mainRef} id="main-content" tabIndex={-1} className={cn("min-h-0 flex-1 overflow-y-auto overscroll-none outline-none", mainClassName)}>
						<PanelShellContent className={contentClassName}>{children}</PanelShellContent>
					</main>
				</SidebarInset>
			</SidebarProvider>
		</div>
	);
});
