"use client";

import { BreadcrumbTrail } from "@workspace/ui/components/breadcrumb-trail";
import { breadcrumbPageLabel, type BreadcrumbItem } from "@workspace/ui/components/breadcrumb-context";
import { toastMessage } from "@workspace/ui/components/toast";
import { Button } from "@workspace/ui/components/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { useIsDesktop } from "@workspace/ui/hooks/use-mobile";
import { buildSidebarView } from "@workspace/ui/lib/sidebar/menu-view";
import { filterCompiledSidebarMenu } from "@/lib/navigation/filter-menu-by-capabilities";
import { SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import { resolvePinnedMenuItems } from "@/lib/navigation/pinned-items";
import { ADMIN_ROUTE_AUTHORIZATION, canAccessRoute, filterMenuByRouteAccess, type RouteAccessSession } from "@/lib/navigation/route-authorization";
import { buildSearchableItems } from "@/lib/palette/search";
import { useSessionPermissionsQuery } from "@/lib/session/capabilities";
import { useSuperAdminStatus } from "@/lib/session/super-admin";
import { RouteAuthorizationGuard } from "@/components/access/route-authorization-guard";
import { AuthorizedNavigationProvider, useCanAccessRoute } from "@/components/layout/authorized-navigation";
import { withAccessibleLinks } from "@/lib/navigation/breadcrumb";
import { ADMIN_PANEL_SIDEBAR_NAV_LABELS, ADMIN_SHELL_LABELS } from "@/lib/sidebar-labels";
import { useAdminBreadcrumb } from "@/components/common/admin-breadcrumb";
import { AdminSidebarPanel } from "@/components/layout/sidebar/sidebar";
import { StoreBoundAppPanelShell } from "@workspace/client/lib/features/sidebar/store-bound-panel-shell";
import { AppShellHeader } from "@workspace/ui/components/app-shell-header";
import { NetworkStatusIndicator } from "@/components/common/network-status-bar";
import { SessionStatusBadge } from "@/components/common/session-status-badge";
import { Profile01 } from "@/components/settings/profile-01";
import { useCommandPaletteShortcut } from "@workspace/ui/components/app-shell-topbar";
import dynamic from "next/dynamic";
import { ScrollToTop } from "@workspace/ui/components/scroll-to-top";
import { useCommandPalettePinnedUrls } from "@workspace/client/lib/features/command-palette/facade";
import { useSidebarCommands, useSidebarExpandedItems, useSidebarSearchQuery, useSidebarSectionOrder } from "@workspace/client/lib/features/sidebar/facade";
import { CapabilitiesProvider } from "@workspace/client/lib/auth/can";
import { createGrantedCapabilities, isCapabilityGranted } from "@workspace/client/lib/auth/permission-check";
import type { CapabilitySlug, Envelope, SessionPermissionsResponse } from "@workspace/shared";
import type { FooterAction, SidebarUser } from "@/lib/navigation/sidebar";

const CommandPalette = dynamic(() => import("@/components/layout/command-palette").then((m) => m.CommandPalette), { ssr: false });

const SKIP_TO_CONTENT_CLASS =
	"sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg";

export interface DashboardLayoutProps {
	readonly user: SidebarUser;
	readonly onLogout: () => void;
	readonly footerActions?: readonly FooterAction[];
	readonly children: React.ReactNode;
	/** Optional notification counts keyed by compiled menu item id. */
	readonly sidebarBadges?: Readonly<Record<string, string | number>>;
	/** The server-prefetched `GET /auth/permissions` envelope (its real `meta`), seeding the permissions query. */
	readonly initialSessionPermissions?: Envelope<SessionPermissionsResponse> | undefined;
	/** Server-evaluated feature flags; items/routes behind a disabled flag are hidden. */
	readonly enabledFeatureFlags?: readonly string[] | undefined;
}

const NO_FEATURE_FLAGS: readonly string[] = [];

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
	const canAccessRoute = useCanAccessRoute();
	// Same rules as the sidebar: a crumb the session may not open is shown, but not linked.
	const items = React.useMemo(() => (status.kind === "ready" ? withAccessibleLinks(status.items, canAccessRoute) : []), [canAccessRoute, status]);
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
			className="mb-0 min-w-0"
			scrollable
			items={items}
			status={status.kind}
			{...(status.kind === "error" ? { errorMessage: status.message } : {})}
			maxItems={maxItems}
			renderLink={renderLink}
			onCopy={handleCopy}
		/>
	);
}

export function DashboardLayout({
	user,
	onLogout,
	footerActions = [],
	children,
	sidebarBadges = {},
	initialSessionPermissions,
	enabledFeatureFlags = NO_FEATURE_FLAGS,
}: DashboardLayoutProps): React.JSX.Element {
	useTrailDocumentTitle();
	const { status: breadcrumbStatus } = useAdminBreadcrumb();
	const sectionOrder = useSidebarSectionOrder();
	const searchQuery = useSidebarSearchQuery();
	const { setSearchQuery, setItemExpanded, resetItemExpansion, moveSectionUp, moveSectionDown } = useSidebarCommands();
	const pinnedUrls = useCommandPalettePinnedUrls();
	const pathname = usePathname();
	const { capabilities, status: permissionsStatus, retry: retryPermissions } = useSessionPermissionsQuery(initialSessionPermissions);
	const superAdmin = useSuperAdminStatus();

	// The facts the route guard decides with — the menu filter and every other
	// link source below evaluate the very same rules, so they cannot disagree.
	const routeSession = React.useMemo((): RouteAccessSession => {
		const granted = createGrantedCapabilities(capabilities);
		return {
			isGranted: (permission: CapabilitySlug): boolean => isCapabilityGranted(granted, permission),
			enabledFeatureFlags,
			isSuperAdmin: superAdmin.isSuperAdmin,
		};
	}, [capabilities, enabledFeatureFlags, superAdmin.isSuperAdmin]);

	// One authorized menu drives the sidebar, the command palette, and pinned
	// favorites: `permission allowed AND feature enabled` (spec semantics of the
	// capability filter), then every item whose page the route guard would
	// deny is removed (`@SuperAdminOnly` pages, per-page rules).
	const filteredMenu = React.useMemo(
		() => filterMenuByRouteAccess(filterCompiledSidebarMenu(SIDEBAR_MENU, capabilities, { enabledFeatureFlags }), ADMIN_ROUTE_AUTHORIZATION, routeSession),
		[capabilities, enabledFeatureFlags, routeSession],
	);

	const canAccessPath = React.useCallback((href: string): boolean => canAccessRoute(ADMIN_ROUTE_AUTHORIZATION, href, routeSession), [routeSession]);

	const searchableItems = React.useMemo(() => buildSearchableItems(filteredMenu), [filteredMenu]);

	const view = React.useMemo(() => buildSidebarView({ menu: filteredMenu, pathname, sectionOrder, searchQuery }), [filteredMenu, pathname, sectionOrder, searchQuery]);

	const pinnedItems = React.useMemo(() => resolvePinnedMenuItems(pinnedUrls, searchableItems), [pinnedUrls, searchableItems]);

	const expandedItems = useSidebarExpandedItems(pathname, view.routeState.autoExpandedItems);

	const handleToggleItem = React.useCallback(
		(itemId: string): void => {
			setItemExpanded(pathname, itemId, expandedItems[itemId] !== true);
		},
		[expandedItems, pathname, setItemExpanded],
	);

	const [commandOpen, setCommandOpen] = React.useState(false);
	const openCommandPalette = React.useCallback((): void => {
		setCommandOpen(true);
	}, []);
	useCommandPaletteShortcut(commandOpen, openCommandPalette);

	const handleSkipToContent = React.useCallback((): void => {
		const main = document.getElementById("main-content");
		if (main === null) {
			return;
		}
		main.focus({ preventScroll: false });
		const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		main.scrollIntoView({ block: "start", behavior: prefersReducedMotion ? "auto" : "smooth" });
	}, []);

	return (
		<CapabilitiesProvider capabilities={capabilities}>
			<AuthorizedNavigationProvider searchableItems={searchableItems} canAccessRoute={canAccessPath}>
				<Button type="button" variant="ghost" onClick={handleSkipToContent} className={SKIP_TO_CONTENT_CLASS}>
					{ADMIN_SHELL_LABELS.skipToContent}
				</Button>
				{commandOpen ? <CommandPalette open setOpen={setCommandOpen} /> : null}
				<StoreBoundAppPanelShell
					sidebarClassName="admin-shell-sidebar"
					scrollResetKey={pathname}
					sidebarBadges={sidebarBadges}
					sidebar={
						<AdminSidebarPanel
							user={user}
							onLogout={onLogout}
							footerActions={footerActions}
							view={view}
							pathname={pathname}
							navLabels={ADMIN_PANEL_SIDEBAR_NAV_LABELS}
							shellLabels={ADMIN_SHELL_LABELS}
							searchQuery={searchQuery}
							onSearchQueryChange={setSearchQuery}
							expandedItems={expandedItems}
							onToggleItem={handleToggleItem}
							onFollowLink={resetItemExpansion}
							onMoveSectionUp={moveSectionUp}
							onMoveSectionDown={moveSectionDown}
							pinnedItems={pinnedItems}
							pageLabel={breadcrumbPageLabel(breadcrumbStatus)}
							status={
								<>
									<NetworkStatusIndicator />
									<SessionStatusBadge compact />
								</>
							}
							profileMenu={<Profile01 user={user} onLogout={onLogout} />}
						/>
					}
					topbar={<AppShellHeader breadcrumb={<ShellBreadcrumb />} onOpenSearch={openCommandPalette} />}
					overlay={<ScrollToTop threshold={300} />}>
					<RouteAuthorizationGuard
						rules={ADMIN_ROUTE_AUTHORIZATION}
						enabledFeatureFlags={enabledFeatureFlags}
						permissionsStatus={permissionsStatus}
						onRetryPermissions={retryPermissions}
						superAdmin={superAdmin}>
						{children}
					</RouteAuthorizationGuard>
				</StoreBoundAppPanelShell>
			</AuthorizedNavigationProvider>
		</CapabilitiesProvider>
	);
}
