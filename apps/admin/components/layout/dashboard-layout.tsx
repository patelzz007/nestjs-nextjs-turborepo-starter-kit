"use client";

import { BreadcrumbTrail } from "@workspace/ui/components/navigation/breadcrumb-trail";
import type { BreadcrumbItem } from "@workspace/ui/components/navigation/breadcrumb-context";
import { Sidebar, SidebarInset, SidebarProvider } from "@workspace/ui/components/navigation/sidebar";
import { DEFAULT_SIDEBAR_LABELS } from "@workspace/ui/lib/sidebar-labels";
import { createNoopSidebarStorage } from "@workspace/ui/lib/sidebar-storage";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { Button } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/utils";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { useMediaQuery } from "@workspace/ui/hooks/use-media-query";
import { buildSidebarView } from "@/lib/navigation/menu";
import { resolvePinnedMenuItems } from "@/lib/navigation/pinned-items";
import { ADMIN_SIDEBAR_LABELS } from "@/lib/sidebar-labels";
import { SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import { useAdminBreadcrumb } from "@/components/common/admin-breadcrumb";
import { AdminSidebarPanel } from "@/components/layout/sidebar/sidebar";
import { useRouteExpandedItems } from "@/components/layout/use-route-expanded-items";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { Topbar } from "@/components/layout/topbar";
import { ScrollToTop } from "@workspace/ui/components/navigation/scroll-to-top";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import { useSidebarStore } from "@/stores/sidebar-store";
import type { FooterAction, SidebarUser } from "@/lib/navigation/sidebar";

const SIDEBAR_STORAGE = createNoopSidebarStorage();

const DEFAULT_WORKSPACES = [{ id: "default", name: SIDEBAR_MENU.header.subtitle }] as const;

const SKIP_TO_CONTENT_CLASS =
	"sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg";

export interface DashboardLayoutProps {
	readonly user: SidebarUser;
	readonly onLogout: () => void;
	readonly footerActions?: readonly FooterAction[];
	readonly children: React.ReactNode;
	/** Optional notification counts keyed by compiled menu item id. */
	readonly sidebarBadges?: Readonly<Record<string, string | number>>;
}

function useTrailDocumentTitle(): void {
	const { status } = useAdminBreadcrumb();

	React.useEffect(() => {
		const trail = status.kind === "ready" ? status.items : [];
		if (trail.length === 0) {
			return;
		}
		const lastItem = trail[trail.length - 1];
		if (lastItem !== undefined) {
			document.title = `${lastItem.label} — Admin`;
		}
	}, [status]);
}

function ShellBreadcrumb(): React.JSX.Element {
	const { status } = useAdminBreadcrumb();
	const isDesktop = useMediaQuery("(min-width: 1024px)");
	const maxItems = isDesktop ? 4 : 2;

	const renderLink = React.useCallback((item: BreadcrumbItem): React.ReactElement => {
		return <Link href={item.href ?? "#"} />;
	}, []);

	const handleCopy = React.useCallback((ok: boolean): void => {
		if (ok) {
			toastMessage.success({ title: "Link copied", description: "The page URL is on your clipboard." });
		} else {
			toastMessage.error({ title: "Could not copy link", description: "Copy the URL from the address bar instead." });
		}
	}, []);

	return (
		<BreadcrumbTrail
			items={status.kind === "ready" ? status.items : []}
			status={status.kind}
			errorMessage={status.kind === "error" ? status.message : undefined}
			maxItems={maxItems}
			renderLink={renderLink}
			onCopy={handleCopy}
		/>
	);
}

export function DashboardLayout({ user, onLogout, footerActions = [], children, sidebarBadges = {} }: DashboardLayoutProps): React.JSX.Element {
	useTrailDocumentTitle();
	const router = useRouter();
	const isOpen = useSidebarStore((s) => s.isOpen);
	const openSidebar = useSidebarStore((s) => s.open);
	const closeSidebar = useSidebarStore((s) => s.close);
	const sectionOrder = useSidebarStore((s) => s.sectionOrder);
	const searchQuery = useSidebarStore((s) => s.searchQuery);
	const setSearchQuery = useSidebarStore((s) => s.setSearchQuery);
	const clearSearch = useSidebarStore((s) => s.clearSearch);
	const storeExpandedItems = useSidebarStore((s) => s.expandedItems);
	const setItemExpanded = useSidebarStore((s) => s.setItemExpanded);
	const resetExpandedItems = useSidebarStore((s) => s.resetExpandedItems);
	const moveSectionUp = useSidebarStore((s) => s.moveSectionUp);
	const moveSectionDown = useSidebarStore((s) => s.moveSectionDown);
	const pinnedUrls = useCommandPaletteStore((s) => s.pinnedUrls);
	const pathname = usePathname();
	const [activeWorkspaceId, setActiveWorkspaceId] = React.useState<string>("default");

	const view = React.useMemo(
		() => buildSidebarView({ menu: SIDEBAR_MENU, pathname, sectionOrder, searchQuery, isHighlightParentItem: false }),
		[pathname, sectionOrder, searchQuery],
	);

	const pinnedItems = React.useMemo(() => resolvePinnedMenuItems(pinnedUrls), [pinnedUrls]);

	const expandedItems = useRouteExpandedItems(pathname, storeExpandedItems, view.routeState.autoExpandedItems, resetExpandedItems);

	React.useEffect(() => {
		void useSidebarStore.persist.rehydrate();
		void useCommandPaletteStore.persist.rehydrate();
	}, []);

	const handleSidebarOpenChange = React.useCallback(
		(open: boolean): void => {
			if (open) {
				openSidebar();
			} else {
				closeSidebar();
			}
		},
		[openSidebar, closeSidebar],
	);

	const debouncedSetSearchQuery = useDebouncedCallback(setSearchQuery, 150);

	const handleSearchChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			debouncedSetSearchQuery(event.target.value);
		},
		[debouncedSetSearchQuery],
	);

	const handleClearSearch = React.useCallback((): void => {
		clearSearch();
	}, [clearSearch]);

	const handleToggleItem = React.useCallback(
		(itemId: string): void => {
			setItemExpanded(itemId, !(expandedItems[itemId] ?? false));
		},
		[expandedItems, setItemExpanded],
	);

	const handleNavigate = React.useCallback(
		(href: string): void => {
			router.push(href);
		},
		[router],
	);

	const handleWorkspaceChange = React.useCallback((workspaceId: string): void => {
		setActiveWorkspaceId(workspaceId);
	}, []);

	const handleSkipToContent = React.useCallback((): void => {
		const main = document.getElementById("main-content");
		if (main === null) {
			return;
		}
		main.focus({ preventScroll: false });
		const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		main.scrollIntoView({ block: "start", behavior: prefersReducedMotion ? "auto" : "smooth" });
	}, []);

	const sidebarProps = React.useMemo(
		() => ({
			user,
			onLogout,
			footerActions,
			view,
			labels: ADMIN_SIDEBAR_LABELS,
			searchQuery,
			onSearchChange: handleSearchChange,
			onClearSearch: handleClearSearch,
			expandedItems,
			onToggleItem: handleToggleItem,
			onNavigate: handleNavigate,
			onMoveSectionUp: moveSectionUp,
			onMoveSectionDown: moveSectionDown,
			pinnedItems,
			workspaces: DEFAULT_WORKSPACES,
			activeWorkspaceId,
			onWorkspaceChange: handleWorkspaceChange,
			navigationKey: pathname,
		}),
		[
			user,
			onLogout,
			footerActions,
			view,
			searchQuery,
			handleSearchChange,
			handleClearSearch,
			expandedItems,
			handleToggleItem,
			handleNavigate,
			moveSectionUp,
			moveSectionDown,
			pinnedItems,
			activeWorkspaceId,
			handleWorkspaceChange,
			pathname,
		],
	);

	return (
		<SidebarProvider open={isOpen} onOpenChange={handleSidebarOpenChange} labels={DEFAULT_SIDEBAR_LABELS} storage={SIDEBAR_STORAGE} badges={sidebarBadges}>
			<Button type="button" variant="ghost" onClick={handleSkipToContent} className={SKIP_TO_CONTENT_CLASS}>
				{ADMIN_SIDEBAR_LABELS.skipToContent}
			</Button>
			<Sidebar collapsible="offcanvas" className="border-sidebar-border">
				<AdminSidebarPanel {...sidebarProps} />
			</Sidebar>
			<SidebarInset className={cn("flex h-svh min-w-0 flex-col overflow-hidden bg-background")}>
				<Topbar user={user} onLogout={onLogout} />
				<main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto overscroll-none outline-none">
					<div className="px-6 pt-6 pb-10">
						<ShellBreadcrumb />
						{children}
					</div>
					<ScrollToTop threshold={300} />
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
