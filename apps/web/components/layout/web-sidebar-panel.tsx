"use client";

import { useCanAccessWebPath } from "@/components/auth/route-access-guard";
import { useWebSession } from "@/components/auth/web-authorization-provider";
import { useWebBreadcrumb } from "@/components/breadcrumb-provider";
import { ImpersonateUserPanel } from "@/components/impersonation/impersonate-user-panel";
import { filterCompiledSidebarMenu } from "@/lib/navigation/filter-menu-by-capabilities";
import { WEB_MENU_ICON_MAP } from "@/lib/navigation/menu-icons";
import { USER_SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import { resolveWebPinnedMenuItems } from "@/lib/navigation/pinned-items";
import { accessiblePaletteItems, renderWebPaletteIcon } from "@/lib/palette/nav-items";
import { useCommandPalettePinnedUrls } from "@workspace/client/lib/features/command-palette/facade";
import { useSidebarCommands, useSidebarExpandedItems, useSidebarSearchQuery, useSidebarSectionOrder } from "@workspace/client/lib/features/sidebar/facade";
import { useAuth } from "@workspace/client/lib/auth";
import { useOwnAvatar } from "@workspace/client/lib/auth/profile/use-own-avatar";
import { breadcrumbPageLabel } from "@workspace/ui/components/breadcrumb-context";
import { PanelSidebarHeader } from "@workspace/ui/components/panel-sidebar-header";
import { PanelSidebarFooterNav, PanelSidebarNav, PanelSidebarRouteAnnouncer } from "@workspace/ui/components/panel-sidebar-nav";
import type { PanelSidebarLinkProps } from "@workspace/ui/components/panel-sidebar-nav-item";
import { SidebarFooter } from "@workspace/ui/components/sidebar";
import { buildSidebarView } from "@workspace/ui/lib/sidebar/menu-view";
import { BrandMark } from "@workspace/ui/components/brand-mark";
import { AppShellSidebarAccount } from "@workspace/ui/components/app-shell-sidebar-account";
import { ShellThemeToggle } from "@workspace/ui/components/shell-theme-toggle";
import { AlertCircle } from "lucide-react";
import { webProfileMenuItems } from "@/components/layout/web-profile-menu";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

export interface WebSidebarPanelProps {
	readonly userName: string | null;
}

function renderWebLink(href: string): React.ReactElement<PanelSidebarLinkProps> {
	return <Link href={href} />;
}

function renderWebMenuIcon(iconName: string | undefined, className: string): React.ReactNode {
	const Icon = iconName !== undefined ? (WEB_MENU_ICON_MAP[iconName] ?? AlertCircle) : AlertCircle;
	return <Icon className={className} aria-hidden="true" />;
}

export function WebSidebarPanel({ userName }: WebSidebarPanelProps): React.JSX.Element {
	const pathname = usePathname();
	const { user, logout } = useAuth();
	// The picture comes from the own profile, which every avatar change reloads — so the sidebar shows it at once.
	const avatar = useOwnAvatar();
	const { capabilities, isAuthenticated } = useWebSession();
	const router = useRouter();
	const canAccessPath = useCanAccessWebPath();
	const { status: breadcrumbStatus } = useWebBreadcrumb();

	const sectionOrder = useSidebarSectionOrder();
	const searchQuery = useSidebarSearchQuery();
	const { setSearchQuery, setItemExpanded, followLink, moveSectionUp, moveSectionDown } = useSidebarCommands();

	const filteredMenu = React.useMemo(() => filterCompiledSidebarMenu(USER_SIDEBAR_MENU, capabilities), [capabilities]);
	const pinnedUrls = useCommandPalettePinnedUrls();

	const view = React.useMemo(() => buildSidebarView({ menu: filteredMenu, pathname, sectionOrder, searchQuery }), [filteredMenu, pathname, sectionOrder, searchQuery]);
	const expandedItems = useSidebarExpandedItems(pathname, view.routeState.autoExpandedItems);
	// A followed link tells the store where it leads: a link to this page resets the branches opened by hand now, one to another page once the route changes.
	const handleFollowLink = React.useCallback(
		(href: string): void => {
			followLink(pathname, href);
		},
		[followLink, pathname],
	);
	const pinnedItems = React.useMemo(() => resolveWebPinnedMenuItems(pinnedUrls, accessiblePaletteItems(canAccessPath)), [pinnedUrls, canAccessPath]);

	const handleToggleExpand = React.useCallback(
		(itemId: string): void => {
			setItemExpanded(pathname, itemId, expandedItems[itemId] !== true);
		},
		[expandedItems, pathname, setItemExpanded],
	);

	const displayName = user?.fullName ?? userName;

	const handleLogout = React.useCallback((): void => {
		void logout();
	}, [logout]);

	const navigate = React.useCallback(
		(path: string): void => {
			router.push(path);
		},
		[router],
	);
	const profileMenuItems = React.useMemo(() => webProfileMenuItems(isAuthenticated, navigate), [isAuthenticated, navigate]);

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden text-sidebar-foreground">
			<PanelSidebarHeader title={filteredMenu.header.title} subtitle={filteredMenu.header.subtitle} icon={<BrandMark className="size-5 text-primary" />} />

			<PanelSidebarNav
				view={view}
				pathname={pathname}
				expandedItems={expandedItems}
				onToggleExpand={handleToggleExpand}
				onFollowLink={handleFollowLink}
				renderLink={renderWebLink}
				renderIcon={renderWebMenuIcon}
				renderPinnedIcon={renderWebPaletteIcon}
				searchQuery={searchQuery}
				onSearchQueryChange={setSearchQuery}
				pinnedItems={pinnedItems}
				onMoveSectionUp={moveSectionUp}
				onMoveSectionDown={moveSectionDown}
			/>

			<SidebarFooter className="max-h-[min(45vh,22rem)] shrink-0 overflow-y-auto border-t border-sidebar-border bg-sidebar-accent/10">
				<PanelSidebarFooterNav
					view={view}
					expandedItems={expandedItems}
					onToggleExpand={handleToggleExpand}
					onFollowLink={handleFollowLink}
					renderLink={renderWebLink}
					renderIcon={renderWebMenuIcon}
					searchQuery={searchQuery}
				/>

				<div className={view.bottomItems.length > 0 ? "px-2 pt-2" : "px-2 pb-2"}>
					<ImpersonateUserPanel />
				</div>
				{displayName !== null ? (
					<AppShellSidebarAccount name={displayName} email={user?.email} avatar={avatar} onLogout={handleLogout} menuItems={profileMenuItems} />
				) : (
					<div className="flex items-center justify-between gap-2 px-2 py-1">
						<p className="text-xs text-muted-foreground">Browse as guest</p>
						<ShellThemeToggle size="icon-xs" className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground [&_svg]:size-3.5" />
					</div>
				)}
			</SidebarFooter>

			<PanelSidebarRouteAnnouncer pageLabel={breadcrumbPageLabel(breadcrumbStatus)} />
		</div>
	);
}
