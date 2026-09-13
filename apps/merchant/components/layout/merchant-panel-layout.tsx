"use client";

import { PanelShellContent } from "@workspace/ui/components/navigation/panel-shell-content";
import { Sidebar, SidebarInset, SidebarProvider } from "@workspace/ui/components/navigation/sidebar";
import { DEFAULT_SIDEBAR_LABELS } from "@workspace/ui/lib/sidebar/labels";
import { createNoopSidebarStorage } from "@workspace/ui/lib/sidebar/storage";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

const MERCHANT_SIDEBAR_STORAGE = createNoopSidebarStorage();

export interface MerchantPanelLayoutProps {
	readonly banner?: React.ReactNode;
	readonly sidebar: React.ReactNode;
	readonly topbar: React.ReactNode;
	readonly children: React.ReactNode;
	readonly contentClassName?: string;
	readonly scrollKey: string;
	readonly sidebarOpen?: boolean;
	readonly onSidebarOpenChange?: (open: boolean) => void;
}

/**
 * Merchant panel chrome — mirrors the admin dashboard layout:
 * fixed-height shell, pinned chrome (banner + topbar), and a single scroll region.
 */
export function MerchantPanelLayout({
	banner,
	sidebar,
	topbar,
	children,
	contentClassName,
	scrollKey,
	sidebarOpen,
	onSidebarOpenChange,
}: MerchantPanelLayoutProps): React.JSX.Element {
	const isControlledSidebar = sidebarOpen !== undefined;
	const mainContentRef = React.useRef<HTMLDivElement>(null);

	React.useLayoutEffect((): void => {
		const resetScroll = (): void => {
			window.scrollTo(0, 0);
			document.documentElement.scrollTop = 0;
			document.body.scrollTop = 0;
			const mainContent = mainContentRef.current;
			if (mainContent !== null) {
				mainContent.scrollTop = 0;
			}
		};

		resetScroll();
		requestAnimationFrame(resetScroll);
	}, [scrollKey]);

	return (
		<SidebarProvider
			defaultOpen={sidebarOpen ?? true}
			open={isControlledSidebar ? sidebarOpen : undefined}
			onOpenChange={isControlledSidebar ? onSidebarOpenChange : undefined}
			labels={DEFAULT_SIDEBAR_LABELS}
			storage={MERCHANT_SIDEBAR_STORAGE}
			className="merchant-panel-shell h-svh overflow-hidden">
			<Sidebar collapsible="offcanvas" className="panel-shell-sidebar border-e border-sidebar-border bg-card">
				{sidebar}
			</Sidebar>
			<SidebarInset className="flex h-svh min-w-0 flex-col overflow-hidden bg-background">
				<div className="shrink-0" data-slot="merchant-panel-chrome">
					{banner}
					{topbar}
				</div>
				<div ref={mainContentRef} id="main-content" key={scrollKey} role="main" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto overscroll-none outline-none">
					<PanelShellContent className={cn("space-y-6", contentClassName)}>{children}</PanelShellContent>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
