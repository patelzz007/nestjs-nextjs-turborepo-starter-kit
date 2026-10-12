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
	/** Uncontrolled only: whether the sidebar starts open (default true) — e.g. a loading shell that mirrors the saved state. */
	readonly defaultSidebarOpen?: boolean;
	readonly sidebarBadges?: Readonly<Record<string, string | number>>;
	/** Per-usage overrides of the `sidebar` family's copy (toggle, mobile sheet) from `UiKitLabelsProvider`. */
	readonly sidebarLabels?: UiKitLabelsOverride<"sidebar">;
	/**
	 * Scrolls the content back to the top when this changes — pass the
	 * pathname. The content scrolls inside `<main>`, not the window, so the
	 * router's own scroll restoration never reaches it. The page is not remounted.
	 */
	readonly scrollResetKey?: string;
	/** What floats over the page inside its scroll area (a scroll-to-top button). */
	readonly overlay?: React.ReactNode;
}

/**
 * The floating page panel: the full screen on phones; on desktop a rounded
 * panel inset from the frame — its height the screen less the inset's margins,
 * so only the page scrolls — on the `shell-panel` surface, edged with the soft
 * card border (`--border`), never a dark rule.
 */
const PANEL_CLASS = "flex h-svh min-w-0 flex-col overflow-hidden bg-shell-panel lg:h-[calc(100svh-(--spacing(4)))] lg:shadow-xs lg:ring-1 lg:ring-border";

/**
 * The panel shell of admin, web and merchant (app shell 3 — the one
 * implementation, no per-app copies): an inset sidebar on the shell's frame
 * that collapses completely (off-canvas, on one spring — lib/sidebar/motion.ts),
 * a mobile sheet drawer, and the page in a floating panel headed by the app's
 * `topbar` (an `AppShellHeader`). Sidebar open/collapse is owned
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
		defaultSidebarOpen = true,
		sidebarBadges = NO_SIDEBAR_BADGES,
		sidebarLabels,
		scrollResetKey,
		overlay,
	},
	ref,
): React.JSX.Element {
	const isControlledSidebar = sidebarOpen !== undefined;
	const mainRef = React.useRef<HTMLElement>(null);
	useResetScrollOnChange(mainRef, scrollResetKey);

	// The page panel is one element, rebuilt only when what it shows changes —
	// never when the sidebar opens or collapses. A toggle re-renders this shell
	// (its open state) and the sidebar, and React skips the panel: the header,
	// the breadcrumb and the page keep still while CSS moves them.
	const panel = React.useMemo(
		(): React.JSX.Element => (
			<SidebarInset className={PANEL_CLASS}>
				{banner}
				{topbar}
				<main ref={mainRef} id="main-content" tabIndex={-1} className={cn("min-h-0 flex-1 overflow-y-auto overscroll-none outline-none", mainClassName)}>
					<PanelShellContent className={contentClassName}>{children}</PanelShellContent>
					{overlay}
				</main>
			</SidebarInset>
		),
		[banner, children, contentClassName, mainClassName, overlay, topbar],
	);

	return (
		<div ref={ref} data-slot="app-panel-shell" className={cn("min-h-svh text-foreground", shellClassName)}>
			<SidebarProvider
				defaultOpen={sidebarOpen ?? defaultSidebarOpen}
				open={isControlledSidebar ? sidebarOpen : undefined}
				onOpenChange={isControlledSidebar ? onSidebarOpenChange : undefined}
				labels={sidebarLabels}
				storage={PANEL_SIDEBAR_STORAGE}
				badges={sidebarBadges}
				className="has-data-[variant=inset]:bg-shell-frame">
				<Sidebar variant="inset" collapsible="offcanvas" className={cn("panel-shell-sidebar", sidebarClassName)}>
					{sidebar}
				</Sidebar>
				{panel}
			</SidebarProvider>
		</div>
	);
});
