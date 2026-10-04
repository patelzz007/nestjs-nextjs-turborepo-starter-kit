"use client";

import { useCanAccessWebPath } from "@/components/auth/route-access-guard";
import { useWebSession } from "@/components/auth/web-authorization-provider";
import { useWebBreadcrumb } from "@/components/breadcrumb-provider";
import { ImpersonateUserPanel } from "@/components/impersonation/impersonate-user-panel";
import { filterCompiledSidebarMenu } from "@/lib/navigation/filter-menu-by-capabilities";
import { WEB_MENU_ICON_MAP } from "@/lib/navigation/menu-icons";
import { USER_SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import { resolveWebPinnedMenuItems } from "@/lib/navigation/pinned-items";
import { WEB_SIDEBAR_LABELS } from "@/lib/navigation/sidebar-labels";
import { accessiblePaletteItems, renderWebPaletteIcon } from "@/lib/palette/nav-items";
import { useCommandPalettePinnedUrls } from "@workspace/client/lib/features/command-palette/facade";
import { useSidebarCommands, useSidebarExpandedItems, useSidebarSearchQuery, useSidebarSectionOrder } from "@workspace/client/lib/features/sidebar/facade";
import { useAuth } from "@workspace/client/lib/auth";
import { breadcrumbPageLabel } from "@workspace/ui/components/navigation/breadcrumb-context";
import { PanelSidebarHeader } from "@workspace/ui/components/navigation/panel-sidebar-header";
import { PanelSidebarFooterNav, PanelSidebarNav, PanelSidebarRouteAnnouncer } from "@workspace/ui/components/navigation/panel-sidebar-nav";
import type { PanelSidebarLinkProps } from "@workspace/ui/components/navigation/panel-sidebar-nav-item";
import { SidebarFooter } from "@workspace/ui/components/navigation/sidebar";
import { buildSidebarView } from "@workspace/ui/lib/sidebar/menu-view";
import { getUserInitials } from "@workspace/ui/lib/core/user-initials";
import { AlertCircle, Gift } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
	const { user } = useAuth();
	const { capabilities } = useWebSession();
	const canAccessPath = useCanAccessWebPath();
	const { status: breadcrumbStatus } = useWebBreadcrumb();

	const sectionOrder = useSidebarSectionOrder();
	const searchQuery = useSidebarSearchQuery();
	const { setSearchQuery, setItemExpanded, moveSectionUp, moveSectionDown } = useSidebarCommands();

	const filteredMenu = React.useMemo(() => filterCompiledSidebarMenu(USER_SIDEBAR_MENU, capabilities), [capabilities]);
	const pinnedUrls = useCommandPalettePinnedUrls();

	const view = React.useMemo(() => buildSidebarView({ menu: filteredMenu, pathname, sectionOrder, searchQuery }), [filteredMenu, pathname, sectionOrder, searchQuery]);
	const expandedItems = useSidebarExpandedItems(pathname, view.routeState.autoExpandedItems);
	const pinnedItems = React.useMemo(() => resolveWebPinnedMenuItems(pinnedUrls, accessiblePaletteItems(canAccessPath)), [pinnedUrls, canAccessPath]);

	const handleToggleExpand = React.useCallback(
		(itemId: string): void => {
			setItemExpanded(pathname, itemId, expandedItems[itemId] !== true);
		},
		[expandedItems, pathname, setItemExpanded],
	);

	const displayName = user?.fullName ?? userName;
	const userInitials = displayName !== null ? getUserInitials(displayName) : "?";

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden bg-card text-sidebar-foreground">
			<PanelSidebarHeader title={filteredMenu.header.title} subtitle={filteredMenu.header.subtitle} icon={<Gift className="size-4 text-primary" aria-hidden="true" />} />

			<PanelSidebarNav
				view={view}
				pathname={pathname}
				expandedItems={expandedItems}
				onToggleExpand={handleToggleExpand}
				renderLink={renderWebLink}
				renderIcon={renderWebMenuIcon}
				renderPinnedIcon={renderWebPaletteIcon}
				searchQuery={searchQuery}
				onSearchQueryChange={setSearchQuery}
				pinnedItems={pinnedItems}
				onMoveSectionUp={moveSectionUp}
				onMoveSectionDown={moveSectionDown}
				labels={WEB_SIDEBAR_LABELS}
			/>

			<SidebarFooter className="max-h-[min(45vh,22rem)] shrink-0 overflow-y-auto border-t border-sidebar-border bg-sidebar-accent/10">
				{displayName !== null ? (
					<div className="flex items-center gap-2.5 px-2 py-2">
						<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-[length:var(--text-sidebar-caption)] font-bold text-sidebar-foreground ring-1 ring-sidebar-border/50">
							{userInitials}
						</div>
						<div className="min-w-0 flex-1">
							<span className="block truncate text-sm leading-tight font-medium text-sidebar-foreground" title={displayName}>
								{displayName}
							</span>
							{user !== null ? (
								<span className="block truncate text-[length:var(--text-sidebar-caption)] leading-tight text-muted-foreground" title={user.email}>
									{user.email}
								</span>
							) : null}
						</div>
					</div>
				) : (
					<p className="px-2 py-2 text-xs text-muted-foreground">Browse as guest</p>
				)}

				<PanelSidebarFooterNav
					view={view}
					expandedItems={expandedItems}
					onToggleExpand={handleToggleExpand}
					renderLink={renderWebLink}
					renderIcon={renderWebMenuIcon}
					searchQuery={searchQuery}
					labels={WEB_SIDEBAR_LABELS}
				/>

				<div className={view.bottomItems.length > 0 ? "px-2 pt-2" : "px-2 pb-2"}>
					<ImpersonateUserPanel />
				</div>
			</SidebarFooter>

			<PanelSidebarRouteAnnouncer pageLabel={breadcrumbPageLabel(breadcrumbStatus)} labels={WEB_SIDEBAR_LABELS} />
		</div>
	);
}
