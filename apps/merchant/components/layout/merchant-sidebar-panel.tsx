"use client";

import { useMerchantAuthorizationStatus } from "@/contexts/organizations/components/access/merchant-authorization-provider";
import { ImpersonateUserPanel } from "@/components/impersonation/impersonate-user-panel";
import { useMerchantBreadcrumb } from "@/components/common/merchant-breadcrumb";
import { isMerchantEnrollmentAllowedPath, useMerchantEnrollmentLock } from "@/contexts/identity/lib/enrollment";
import { applyEnrollmentNavLock } from "@/lib/navigation/apply-enrollment-nav-lock";
import { createMerchantNavHrefResolver } from "@/lib/navigation/resolve-nav-href";
import { useMerchantSessionProfile } from "@/lib/session/profile";
import type { ServerUser } from "@/contexts/identity/lib/server";
import { filterCompiledSidebarMenu } from "@/lib/navigation/filter-menu-by-capabilities";
import { MERCHANT_SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import { resolveMerchantPinnedMenuItems } from "@/lib/navigation/pinned-items";
import { MERCHANT_MENU_ICON_MAP } from "@/lib/navigation/menu-icons";
import { renderMerchantPaletteIcon } from "@/lib/palette/nav-items";
import { useCommandPalettePinnedUrls } from "@workspace/client/lib/features/command-palette/facade";
import { useSidebarCommands, useSidebarExpandedItems, useSidebarSearchQuery, useSidebarSectionOrder } from "@workspace/client/lib/features/sidebar/facade";
import { useAuthorization } from "@workspace/client/lib/contexts/authorization";
import { useOwnAvatar } from "@workspace/client/lib/contexts/identity/profile/use-own-avatar";
import type { OrganizationRewardMembershipResponse } from "@workspace/shared";
import { breadcrumbPageLabel } from "@workspace/ui/components/breadcrumb-context";
import { PanelSidebarFooterNav, PanelSidebarNav, PanelSidebarRouteAnnouncer, type PanelSidebarPinnedItem } from "@workspace/ui/components/panel-sidebar-nav";
import type { PanelSidebarLinkProps } from "@workspace/ui/components/panel-sidebar-nav-item";
import { SidebarFooter } from "@workspace/ui/components/sidebar";
import { buildSidebarView } from "@workspace/ui/lib/sidebar/menu-view";
import { withResolvedSidebarMenuUrls } from "@workspace/ui/lib/sidebar/resolve-menu-hrefs";
import { AppShellSidebarAccount } from "@workspace/ui/components/app-shell-sidebar-account";
import { MERCHANT_CAPABILITY } from "@workspace/shared";
import { useOrganizationPath } from "@/contexts/organizations/lib/org/use-organization-path";
import { ORG_ROUTES } from "@/lib/routes";
import { useMerchantLogout } from "@/lib/session/use-merchant-logout";
import { AlertCircle } from "lucide-react";
import { MerchantContextSwitcher } from "@/components/layout/merchant-context-switcher";
import { merchantProfileMenuItems } from "@/components/layout/merchant-profile-menu";
import { useActiveMembership } from "@/features/tenant-context/facade";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

export interface MerchantSidebarPanelProps {
	/** The first page of the member's stores (the switcher's list). */
	readonly memberships: readonly OrganizationRewardMembershipResponse[];
	/** Whether the member has more stores than that page — the switcher then links to the stores page. */
	readonly hasMoreStores: boolean;
	readonly organizationSlug: string | undefined;
	readonly onStoreChange: (slug: string) => void;
	/** The identity the server decoded — shown on first paint, until the session profile has loaded. */
	readonly initialUser?: ServerUser | null;
}

function renderMerchantLink(href: string): React.ReactElement<PanelSidebarLinkProps> {
	return <Link href={href} />;
}

function renderMerchantMenuIcon(iconName: string | undefined, className: string): React.ReactNode {
	const Icon = iconName !== undefined ? (MERCHANT_MENU_ICON_MAP[iconName] ?? AlertCircle) : AlertCircle;
	return <Icon className={className} aria-hidden="true" />;
}

export function MerchantSidebarPanel({ memberships, hasMoreStores, organizationSlug, onStoreChange, initialUser = null }: MerchantSidebarPanelProps): React.JSX.Element {
	const pathname = usePathname();
	const sessionProfile = useMerchantSessionProfile();
	const { isLocked: isEnrollmentLocked, disabledTooltip: enrollmentDisabledTooltip, enrollmentReason } = useMerchantEnrollmentLock();
	const { can } = useAuthorization();
	// The picture comes from the own profile, which every avatar change reloads.
	const avatar = useOwnAvatar();
	const { capabilities: menuFilterCapabilities } = useMerchantAuthorizationStatus();
	const { status: breadcrumbStatus } = useMerchantBreadcrumb();
	const { membership: activeMembership } = useActiveMembership();

	const sectionOrder = useSidebarSectionOrder();
	const searchQuery = useSidebarSearchQuery();
	const resolveNavHref = React.useMemo(() => createMerchantNavHrefResolver(organizationSlug), [organizationSlug]);
	const { setSearchQuery, setItemExpanded, followLink, moveSectionUp, moveSectionDown } = useSidebarCommands();
	const pinnedUrls = useCommandPalettePinnedUrls();

	const filteredMenu = React.useMemo(() => filterCompiledSidebarMenu(MERCHANT_SIDEBAR_MENU, menuFilterCapabilities), [menuFilterCapabilities]);
	const enrollmentLockedMenu = React.useMemo(() => applyEnrollmentNavLock(filteredMenu, isEnrollmentLocked), [filteredMenu, isEnrollmentLocked]);
	const resolvedMenu = React.useMemo(() => withResolvedSidebarMenuUrls(enrollmentLockedMenu, resolveNavHref), [enrollmentLockedMenu, resolveNavHref]);

	const view = React.useMemo(() => buildSidebarView({ menu: resolvedMenu, pathname, sectionOrder, searchQuery }), [resolvedMenu, pathname, sectionOrder, searchQuery]);
	const expandedItems = useSidebarExpandedItems(pathname, view.routeState.autoExpandedItems);
	// A followed link tells the store where it leads: a link to this page resets the branches opened by hand now, one to another page once the route changes.
	const handleFollowLink = React.useCallback(
		(href: string): void => {
			followLink(pathname, href);
		},
		[followLink, pathname],
	);

	const pinnedItems = React.useMemo(
		(): readonly PanelSidebarPinnedItem[] =>
			resolveMerchantPinnedMenuItems(pinnedUrls, can).map((pinned) => ({
				title: pinned.title,
				url: resolveNavHref(pinned.url),
				icon: pinned.icon,
				disabled: isEnrollmentLocked && !isMerchantEnrollmentAllowedPath(pinned.url),
			})),
		[pinnedUrls, can, resolveNavHref, isEnrollmentLocked],
	);

	const handleToggleExpand = React.useCallback(
		(itemId: string): void => {
			setItemExpanded(pathname, itemId, expandedItems[itemId] !== true);
		},
		[expandedItems, pathname, setItemExpanded],
	);

	const logout = useMerchantLogout();
	const router = useRouter();
	const settingsPath = useOrganizationPath(ORG_ROUTES.settings.index);
	const accountPath = useOrganizationPath(ORG_ROUTES.account);
	const dashboardPath = useOrganizationPath(ORG_ROUTES.dashboard);
	const apiKeysPath = useOrganizationPath(ORG_ROUTES.apiKeys);

	const profileName = sessionProfile.isLoading && initialUser !== null ? initialUser.name : sessionProfile.fullName;
	const profileEmail = sessionProfile.isLoading && initialUser !== null ? initialUser.email : sessionProfile.email;

	const handleLogout = React.useCallback((): void => {
		void logout();
	}, [logout]);

	const navigate = React.useCallback(
		(path: string): void => {
			router.push(path);
		},
		[router],
	);
	const profileMenuItems = React.useMemo(
		() =>
			merchantProfileMenuItems(
				{ isEnrollmentLocked, canViewDashboard: can(MERCHANT_CAPABILITY.viewDashboard), canManageApiKeys: can(MERCHANT_CAPABILITY.manageApiKeys) },
				{ account: accountPath, dashboard: dashboardPath, apiKeys: apiKeysPath, settings: settingsPath },
				navigate,
			),
		[accountPath, apiKeysPath, can, dashboardPath, isEnrollmentLocked, navigate, settingsPath],
	);
	const showNoCapabilities = menuFilterCapabilities.length === 0 && activeMembership !== undefined && !view.isSearching && view.sections.length === 0;
	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden text-sidebar-foreground">
			<MerchantContextSwitcher memberships={memberships} hasMoreStores={hasMoreStores} organizationSlug={organizationSlug} onStoreChange={onStoreChange} />

			<PanelSidebarNav
				view={view}
				pathname={pathname}
				expandedItems={expandedItems}
				onToggleExpand={handleToggleExpand}
				onFollowLink={handleFollowLink}
				renderLink={renderMerchantLink}
				renderIcon={renderMerchantMenuIcon}
				renderPinnedIcon={renderMerchantPaletteIcon}
				searchQuery={searchQuery}
				onSearchQueryChange={setSearchQuery}
				pinnedItems={pinnedItems}
				onMoveSectionUp={moveSectionUp}
				onMoveSectionDown={moveSectionDown}
				unavailableTitle={enrollmentDisabledTooltip}
				notice={
					<>
						{isEnrollmentLocked ? (
							<div className="mx-2 mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-950 dark:text-amber-100">
								{enrollmentReason === "mfa_enrollment"
									? "Set up two-factor authentication to unlock navigation. Your Account page stays available until enrollment is complete."
									: "Verify your email to unlock navigation. Your Account page stays available until verification is complete."}
							</div>
						) : null}
						{showNoCapabilities ? (
							<div className="flex flex-col items-center justify-center px-3 py-10 text-center">
								<p className="text-sm text-muted-foreground">No portal access configured for {activeMembership.role}.</p>
								<p className="mt-1 text-xs text-muted-foreground">Ask a platform admin to grant capabilities under Merchant roles.</p>
							</div>
						) : null}
					</>
				}
			/>

			<SidebarFooter className="max-h-[min(45vh,22rem)] shrink-0 overflow-y-auto border-t border-sidebar-border bg-sidebar-accent/10">
				<PanelSidebarFooterNav
					view={view}
					expandedItems={expandedItems}
					onToggleExpand={handleToggleExpand}
					onFollowLink={handleFollowLink}
					renderLink={renderMerchantLink}
					renderIcon={renderMerchantMenuIcon}
					searchQuery={searchQuery}
					unavailableTitle={enrollmentDisabledTooltip}
				/>

				<div className={view.bottomItems.length > 0 ? "px-2 pt-2" : "px-2 pb-2"}>
					<ImpersonateUserPanel />
				</div>
				<AppShellSidebarAccount name={profileName} email={profileEmail} avatar={avatar} onLogout={handleLogout} menuItems={profileMenuItems} />
			</SidebarFooter>

			<PanelSidebarRouteAnnouncer pageLabel={breadcrumbPageLabel(breadcrumbStatus)} />
		</div>
	);
}
