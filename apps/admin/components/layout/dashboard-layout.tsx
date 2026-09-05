"use client";

import { BreadcrumbTrail } from "@workspace/ui/components/navigation/breadcrumb-trail";
import type { BreadcrumbItem } from "@workspace/ui/components/navigation/breadcrumb-context";
import { PanelShellContent } from "@workspace/ui/components/navigation/panel-shell-content";
import { Sidebar, SidebarInset, SidebarProvider } from "@workspace/ui/components/navigation/sidebar";
import { DEFAULT_SIDEBAR_LABELS } from "@workspace/ui/lib/sidebar-labels";
import { createNoopSidebarStorage } from "@workspace/ui/lib/sidebar-storage";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { Button } from "@workspace/ui/components/form/button";
import { cn } from "@workspace/ui/lib/utils";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { useIsDesktop } from "@workspace/ui/hooks/use-mobile";
import { buildSidebarView } from "@/lib/navigation/menu";
import { filterCompiledSidebarMenu } from "@/lib/navigation/filter-menu-by-capabilities";
import { SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import { resolvePinnedMenuItems } from "@/lib/navigation/pinned-items";
import { useSessionCapabilities } from "@/lib/session-capabilities";
import { ADMIN_SIDEBAR_LABELS } from "@/lib/sidebar-labels";
import { useAdminBreadcrumb } from "@/components/common/admin-breadcrumb";
import { AdminSidebarPanel } from "@/components/layout/sidebar/sidebar";
import { useRouteExpandedItems } from "@/components/layout/use-route-expanded-items";
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { Topbar } from "@/components/layout/topbar";
import { ScrollToTop } from "@workspace/ui/components/navigation/scroll-to-top";
import { useCommandPaletteStore } from "@/stores/command-palette-store";
import { useSidebarStore } from "@/stores/sidebar-store";
import { SidebarPathSync } from "@workspace/client/lib/sidebar/sidebar-path-sync";
import type { CompiledSidebarMenuData } from "@workspace/client/lib/sidebar/sidebar-menu-schema";
import type { CapabilitySlug, SessionPermissionsResponse } from "@workspace/shared";
import type { FooterAction, SidebarUser } from "@/lib/navigation/sidebar";

const SIDEBAR_STORAGE = createNoopSidebarStorage();

function useDefaultWorkspaces(): readonly { readonly id: string; readonly name: string }[] {
	const menuSubtitle = useSidebarStore((state) => state.menu.header.subtitle);
	return React.useMemo(() => [{ id: "default", name: menuSubtitle }], [menuSubtitle]);
}

const SKIP_TO_CONTENT_CLASS =
	"sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg";

export interface DashboardLayoutProps {
	readonly user: SidebarUser;
	readonly onLogout: () => void;
	readonly footerActions?: readonly FooterAction[];
	readonly children: React.ReactNode;
	/** Optional notification counts keyed by compiled menu item id. */
	readonly sidebarBadges?: Readonly<Record<string, string | number>>;
	readonly initialSessionPermissions?: SessionPermissionsResponse;
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
	const isDesktop = useIsDesktop();
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

export function DashboardLayout({ user, onLogout, footerActions = [], children, sidebarBadges = {}, initialSessionPermissions }: DashboardLayoutProps): React.JSX.Element {
	useTrailDocumentTitle();
	const router = useRouter();
	const isOpen = useSidebarStore((s) => s.isOpen);
	const openSidebar = useSidebarStore((s) => s.open);
	const closeSidebar = useSidebarStore((s) => s.close);
	const sectionOrder = useSidebarStore((s) => s.sectionOrder);
	const searchQuery = useSidebarStore((s) => s.searchQuery);
	const menu = useSidebarStore((s) => s.menu);
	const setSearchQuery = useSidebarStore((s) => s.setSearchQuery);
	const clearSearch = useSidebarStore((s) => s.clearSearch);
	const storeExpandedItems = useSidebarStore((s) => s.expandedItems);
	const setItemExpanded = useSidebarStore((s) => s.setItemExpanded);
	const resetExpandedItems = useSidebarStore((s) => s.resetExpandedItems);
	const moveSectionUp = useSidebarStore((s) => s.moveSectionUp);
	const moveSectionDown = useSidebarStore((s) => s.moveSectionDown);
	const pinnedUrls = useCommandPaletteStore((s) => s.pinnedUrls);
	const pathname = usePathname();
	const defaultWorkspaces = useDefaultWorkspaces();
	const currentPage = pathname;
	const [activeWorkspaceId, setActiveWorkspaceId] = React.useState<string>("default");
	const { capabilities, isReady: isCapabilitiesReady } = useSessionCapabilities(initialSessionPermissions);

	const displayMenu = React.useMemo(
		(): CompiledSidebarMenuData => ({
			header: menu.header,
			sections: menu.sections,
			bottomItems: menu.bottomItems.length > 0 ? menu.bottomItems : SIDEBAR_MENU.bottomItems,
		}),
		[menu],
	);

	const filterCapabilities = React.useMemo((): readonly CapabilitySlug[] => {
		if (isCapabilitiesReady && capabilities.length > 0) {
			return capabilities;
		}
		return initialSessionPermissions?.capabilities ?? [];
	}, [capabilities, initialSessionPermissions?.capabilities, isCapabilitiesReady]);

	const filteredMenu = React.useMemo(() => filterCompiledSidebarMenu(displayMenu, filterCapabilities), [displayMenu, filterCapabilities]);

	const view = React.useMemo(
		() => buildSidebarView({ menu: filteredMenu, pathname: currentPage, sectionOrder, searchQuery, isHighlightParentItem: false }),
		[filteredMenu, currentPage, sectionOrder, searchQuery],
	);

	const pinnedItems = React.useMemo(() => resolvePinnedMenuItems(pinnedUrls), [pinnedUrls]);

	const expandedItems = useRouteExpandedItems(currentPage, storeExpandedItems, view.routeState.autoExpandedItems, resetExpandedItems);

	React.useLayoutEffect((): void => {
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
			workspaces: defaultWorkspaces,
			activeWorkspaceId,
			onWorkspaceChange: handleWorkspaceChange,
			navigationKey: currentPage,
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
			defaultWorkspaces,
			activeWorkspaceId,
			handleWorkspaceChange,
			currentPage,
		],
	);

	return (
		<SidebarProvider open={isOpen} onOpenChange={handleSidebarOpenChange} labels={DEFAULT_SIDEBAR_LABELS} storage={SIDEBAR_STORAGE} badges={sidebarBadges}>
			<SidebarPathSync store={useSidebarStore} />
			<Button type="button" variant="ghost" onClick={handleSkipToContent} className={SKIP_TO_CONTENT_CLASS}>
				{ADMIN_SIDEBAR_LABELS.skipToContent}
			</Button>
			<Sidebar collapsible="offcanvas" className="admin-shell-sidebar border-e border-sidebar-border bg-card">
				<AdminSidebarPanel {...sidebarProps} />
			</Sidebar>
			<SidebarInset className={cn("flex h-svh min-w-0 flex-col overflow-hidden bg-background")}>
				<Topbar user={user} onLogout={onLogout} />
				<main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto overscroll-none outline-none">
					<PanelShellContent>
						<ShellBreadcrumb />
						{children}
					</PanelShellContent>
					<ScrollToTop threshold={300} />
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
