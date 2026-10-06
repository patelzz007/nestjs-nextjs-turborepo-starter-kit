"use client";

import { useMerchantAuthorizationStatus } from "@/components/access/merchant-authorization-provider";
import { ImpersonateUserPanel } from "@/components/impersonation/impersonate-user-panel";
import { useMerchantBreadcrumb } from "@/components/common/merchant-breadcrumb";
import { isMerchantEnrollmentAllowedPath, useMerchantEnrollmentLock } from "@/lib/auth/enrollment";
import { applyEnrollmentNavLock } from "@/lib/navigation/apply-enrollment-nav-lock";
import { createMerchantNavHrefResolver } from "@/lib/navigation/resolve-nav-href";
import { useMerchantSessionProfile } from "@/lib/session/profile";
import { filterCompiledSidebarMenu } from "@/lib/navigation/filter-menu-by-capabilities";
import { MERCHANT_SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import { resolveMerchantPinnedMenuItems } from "@/lib/navigation/pinned-items";
import { MERCHANT_MENU_ICON_MAP } from "@/lib/navigation/menu-icons";
import { renderMerchantPaletteIcon } from "@/lib/palette/nav-items";
import { useCommandPalettePinnedUrls } from "@workspace/client/lib/features/command-palette/facade";
import { useSidebarCommands, useSidebarExpandedItems, useSidebarSearchQuery, useSidebarSectionOrder } from "@workspace/client/lib/features/sidebar/facade";
import { resolveActiveOrganizationMembership } from "@/lib/session/server-capabilities";
import { useAuthorization } from "@workspace/client/lib/auth/can";
import type { OrganizationRewardMembershipResponse } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import { Label } from "@workspace/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { breadcrumbPageLabel } from "@workspace/ui/components/breadcrumb-context";
import { PanelSidebarHeader } from "@workspace/ui/components/panel-sidebar-header";
import { PanelSidebarFooterNav, PanelSidebarNav, PanelSidebarRouteAnnouncer, type PanelSidebarPinnedItem } from "@workspace/ui/components/panel-sidebar-nav";
import type { PanelSidebarLinkProps } from "@workspace/ui/components/panel-sidebar-nav-item";
import { SidebarFooter } from "@workspace/ui/components/sidebar";
import { buildSidebarView } from "@workspace/ui/lib/sidebar/menu-view";
import { withResolvedSidebarMenuUrls } from "@workspace/ui/lib/sidebar/resolve-menu-hrefs";
import { getUserInitials } from "@workspace/ui/lib/core/user-initials";
import { AlertCircle, Gift } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

export interface MerchantSidebarPanelProps {
	readonly memberships: readonly OrganizationRewardMembershipResponse[];
	readonly organizationSlug: string | undefined;
	readonly onStoreChange: (slug: string) => void;
}

function renderMerchantLink(href: string): React.ReactElement<PanelSidebarLinkProps> {
	return <Link href={href} />;
}

function renderMerchantMenuIcon(iconName: string | undefined, className: string): React.ReactNode {
	const Icon = iconName !== undefined ? (MERCHANT_MENU_ICON_MAP[iconName] ?? AlertCircle) : AlertCircle;
	return <Icon className={className} aria-hidden="true" />;
}

export function MerchantSidebarPanel({ memberships, organizationSlug, onStoreChange }: MerchantSidebarPanelProps): React.JSX.Element {
	const pathname = usePathname();
	const sessionProfile = useMerchantSessionProfile();
	const { isLocked: isEnrollmentLocked, disabledTooltip: enrollmentDisabledTooltip, enrollmentReason } = useMerchantEnrollmentLock();
	const { can } = useAuthorization();
	const { capabilities: menuFilterCapabilities } = useMerchantAuthorizationStatus();
	const { status: breadcrumbStatus } = useMerchantBreadcrumb();
	const activeMembership = resolveActiveOrganizationMembership(memberships, organizationSlug);

	const sectionOrder = useSidebarSectionOrder();
	const searchQuery = useSidebarSearchQuery();
	const resolveNavHref = React.useMemo(() => createMerchantNavHrefResolver(organizationSlug), [organizationSlug]);
	const { setSearchQuery, setItemExpanded, moveSectionUp, moveSectionDown } = useSidebarCommands();
	const pinnedUrls = useCommandPalettePinnedUrls();

	const filteredMenu = React.useMemo(() => filterCompiledSidebarMenu(MERCHANT_SIDEBAR_MENU, menuFilterCapabilities), [menuFilterCapabilities]);
	const enrollmentLockedMenu = React.useMemo(() => applyEnrollmentNavLock(filteredMenu, isEnrollmentLocked), [filteredMenu, isEnrollmentLocked]);
	const resolvedMenu = React.useMemo(() => withResolvedSidebarMenuUrls(enrollmentLockedMenu, resolveNavHref), [enrollmentLockedMenu, resolveNavHref]);

	const view = React.useMemo(() => buildSidebarView({ menu: resolvedMenu, pathname, sectionOrder, searchQuery }), [resolvedMenu, pathname, sectionOrder, searchQuery]);
	const expandedItems = useSidebarExpandedItems(pathname, view.routeState.autoExpandedItems);

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

	const handleStoreChange = React.useCallback(
		(value: string | null): void => {
			if (value !== null) {
				onStoreChange(value);
			}
		},
		[onStoreChange],
	);

	const userInitials = getUserInitials(sessionProfile.fullName);
	const showNoCapabilities = menuFilterCapabilities.length === 0 && activeMembership !== undefined && !view.isSearching && view.sections.length === 0;
	const formatStoreValue = React.useCallback((slug: string): string => memberships.find((row) => row.organizationSlug === slug)?.displayName ?? slug, [memberships]);

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground">
			<PanelSidebarHeader
				title={MERCHANT_SIDEBAR_MENU.header.title}
				subtitle={MERCHANT_SIDEBAR_MENU.header.subtitle}
				icon={<Gift className="size-4 text-primary" aria-hidden="true" />}
			/>

			<PanelSidebarNav
				view={view}
				pathname={pathname}
				expandedItems={expandedItems}
				onToggleExpand={handleToggleExpand}
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
								<p className="mt-1 text-xs text-muted-foreground">Ask an admin to grant capabilities under Reward Hub → Merchant roles.</p>
							</div>
						) : null}
					</>
				}
			/>

			<SidebarFooter className="max-h-[min(45vh,22rem)] shrink-0 overflow-y-auto border-t border-sidebar-border bg-sidebar-accent/10">
				<div className="flex items-center gap-2.5 px-2 py-2">
					<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-[length:var(--text-sidebar-caption)] font-bold text-sidebar-foreground ring-1 ring-sidebar-border/50">
						{userInitials}
					</div>
					<div className="min-w-0 flex-1">
						<span className="block truncate text-sm leading-tight font-medium text-sidebar-foreground" title={sessionProfile.fullName}>
							{sessionProfile.fullName}
						</span>
						<span className="block truncate text-[length:var(--text-sidebar-caption)] leading-tight text-muted-foreground" title={sessionProfile.email}>
							{sessionProfile.email}
						</span>
					</div>
				</div>

				{activeMembership !== undefined ? (
					<div className="px-2 pb-2">
						<div className="min-w-0 overflow-hidden rounded-lg border border-sidebar-border bg-background/60 px-3 py-3">
							<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Active store</p>
							<p className="mt-1 truncate text-sm font-semibold text-sidebar-foreground" title={activeMembership.displayName}>
								{activeMembership.displayName}
							</p>
							<Badge variant="secondary" className="mt-2">
								{activeMembership.role}
							</Badge>
							{memberships.length > 1 ? (
								<div className="mt-3 space-y-1">
									<Label className="text-xs">Switch store</Label>
									<Select<string> value={organizationSlug ?? ""} onValueChange={handleStoreChange}>
										<SelectTrigger className="w-full min-w-0">
											<SelectValue placeholder="Select store" formatValue={formatStoreValue} />
										</SelectTrigger>
										<SelectContent>
											{memberships.map((row) => (
												<SelectItem key={row.organizationId} value={row.organizationSlug}>
													{row.displayName}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							) : null}
						</div>
					</div>
				) : null}

				<PanelSidebarFooterNav
					view={view}
					expandedItems={expandedItems}
					onToggleExpand={handleToggleExpand}
					renderLink={renderMerchantLink}
					renderIcon={renderMerchantMenuIcon}
					searchQuery={searchQuery}
					unavailableTitle={enrollmentDisabledTooltip}
				/>

				<div className={view.bottomItems.length > 0 ? "px-2 pt-2" : "px-2 pb-2"}>
					<ImpersonateUserPanel />
				</div>
			</SidebarFooter>

			<PanelSidebarRouteAnnouncer pageLabel={breadcrumbPageLabel(breadcrumbStatus)} />
		</div>
	);
}
