"use client";

import { MerchantAuthorizationProvider } from "@/components/access/merchant-authorization-provider";
import { MerchantBreadcrumbProvider } from "@/components/common/merchant-breadcrumb";
import { MerchantShellBreadcrumb } from "@/components/layout/merchant-shell-breadcrumb";
import { MerchantShellBanners } from "@/components/merchant-shell-banners";
import { ImpersonateUserPanel } from "@/components/impersonation/impersonate-user-panel";
import { MerchantPanelLayout } from "@/components/layout/merchant-panel-layout";
import { MerchantSidebarPanel } from "@/components/layout/merchant-sidebar-panel";
import { MerchantTopbar } from "@/components/layout/merchant-topbar";
import type { ServerUser } from "@/lib/auth/server";
import { initialDataOption, stubApiMeta, successEnvelope } from "@workspace/client/lib/api/envelope";
import { MERCHANT_ME_QUERY_OPTIONS } from "@/lib/session/me-query";
import { TenantContextProvider } from "@/features/tenant-context/facade";
import { useSwitchOrganization } from "@/lib/org/use-switch-organization";
import { useAuth } from "@workspace/client/lib/auth";
import type { OrganizationContextResponse, OrganizationRewardMembershipResponse } from "@workspace/shared";
import { useSidebar as useShellSidebar } from "@workspace/ui/components/navigation/sidebar";
import { isMobileViewport } from "@workspace/ui/hooks/use-mobile";
import { MERCHANT_COMMAND_PALETTE_DEVTOOLS_NAME, MERCHANT_COMMAND_PALETTE_STORAGE_KEY } from "@/lib/palette/store-config";
import { CommandPaletteStoreProvider } from "@workspace/client/lib/features/command-palette/facade";
import { MERCHANT_SIDEBAR_DEVTOOLS_NAME, MERCHANT_SIDEBAR_STORAGE_KEY } from "@/lib/navigation/sidebar-menu";
import { SidebarStoreProvider, useSidebarCommands, useSidebarIsOpen } from "@workspace/client/lib/features/sidebar/facade";
import { MERCHANT_UI_PREFERENCES_DEVTOOLS_NAME, MERCHANT_UI_PREFERENCES_STORAGE_KEY } from "@/lib/ui-preferences/store-config";
import { UiPreferencesStoreProvider } from "@workspace/client/lib/features/ui-preferences/facade";
import { usePathname } from "next/navigation";
import * as React from "react";

export interface MerchantShellProps {
	readonly children: React.ReactNode;
	/** The `[orgSlug]` URL segment — the active organization (the URL owns it). */
	readonly orgSlug: string;
	/** The member's store choice as the server read it from the `organizationLocationId` cookie. */
	readonly initialLocationId: string | null;
	/** Organization context the server loaded — seeds the tenant context's accessible locations. */
	readonly initialOrganizationContext?: OrganizationContextResponse | undefined;
	readonly initialMemberships?: readonly OrganizationRewardMembershipResponse[];
	readonly initialUser?: ServerUser | null;
	readonly initialIsImpersonating?: boolean;
}

function MerchantSidebarContent({
	memberships,
	organizationSlug,
	onStoreChange,
}: {
	readonly memberships: readonly OrganizationRewardMembershipResponse[];
	readonly organizationSlug: string;
	readonly onStoreChange: (slug: string) => void;
}): React.JSX.Element {
	const { setOpenMobile } = useShellSidebar();

	const handleNavigate = React.useCallback((): void => {
		if (isMobileViewport()) {
			setOpenMobile(false);
		}
	}, [setOpenMobile]);

	return <MerchantSidebarPanel memberships={memberships} organizationSlug={organizationSlug} onStoreChange={onStoreChange} onNavigate={handleNavigate} />;
}

/** Merchant portal chrome — custom sidebar + topbar with command palette. */
export function MerchantShell(props: MerchantShellProps): React.JSX.Element {
	return (
		<SidebarStoreProvider storageKey={MERCHANT_SIDEBAR_STORAGE_KEY} devtoolsName={MERCHANT_SIDEBAR_DEVTOOLS_NAME}>
			<CommandPaletteStoreProvider storageKey={MERCHANT_COMMAND_PALETTE_STORAGE_KEY} devtoolsName={MERCHANT_COMMAND_PALETTE_DEVTOOLS_NAME}>
				<UiPreferencesStoreProvider storageKey={MERCHANT_UI_PREFERENCES_STORAGE_KEY} devtoolsName={MERCHANT_UI_PREFERENCES_DEVTOOLS_NAME}>
					<MerchantShellContent {...props} />
				</UiPreferencesStoreProvider>
			</CommandPaletteStoreProvider>
		</SidebarStoreProvider>
	);
}

function MerchantShellContent({
	children,
	orgSlug,
	initialLocationId,
	initialOrganizationContext,
	initialMemberships,
	initialUser = null,
	initialIsImpersonating = false,
}: MerchantShellProps): React.JSX.Element {
	const { api } = useAuth();
	const pathname = usePathname();
	const switchOrganization = useSwitchOrganization();
	const sidebarOpen = useSidebarIsOpen();
	const { open: openSidebar, close: closeSidebar } = useSidebarCommands();

	const handleSidebarOpenChange = React.useCallback(
		(open: boolean): void => {
			if (open) {
				openSidebar();
			} else {
				closeSidebar();
			}
		},
		[closeSidebar, openSidebar],
	);

	const initialMeData = React.useMemo(
		() => (initialMemberships !== undefined && initialMemberships.length > 0 ? successEnvelope([...initialMemberships], stubApiMeta()) : undefined),
		[initialMemberships],
	);

	const membershipsQuery = api.organizations.membershipsBootstrap.useQuery(
		{},
		{
			...initialDataOption(initialMeData),
			...MERCHANT_ME_QUERY_OPTIONS,
		},
	);

	const memberships = React.useMemo((): readonly OrganizationRewardMembershipResponse[] => membershipsQuery.data?.data ?? [], [membershipsQuery.data?.data]);

	const hasMemberships = memberships.length > 0;
	const showMembershipGate = membershipsQuery.isFetched && !hasMemberships;
	const showMembershipLoading = !hasMemberships && membershipsQuery.isLoading;

	return (
		<MerchantAuthorizationProvider initialMemberships={initialMemberships}>
			<TenantContextProvider orgSlug={orgSlug} initialLocationId={initialLocationId} initialOrganizationContext={initialOrganizationContext}>
				<MerchantBreadcrumbProvider>
					<MerchantPanelLayout
						scrollKey={pathname}
						banner={<MerchantShellBanners initialIsImpersonating={initialIsImpersonating} />}
						sidebarOpen={sidebarOpen}
						onSidebarOpenChange={handleSidebarOpenChange}
						sidebar={<MerchantSidebarContent memberships={memberships} organizationSlug={orgSlug} onStoreChange={switchOrganization} />}
						topbar={<MerchantTopbar initialUser={initialUser} />}>
						{showMembershipLoading ? (
							<p className="text-sm text-muted-foreground">Loading merchant access…</p>
						) : showMembershipGate ? (
							<div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
								<p className="text-sm font-medium text-foreground">No merchant membership found</p>
								<p className="mt-2 text-sm text-muted-foreground">Ask an admin for an invite, or impersonate a merchant owner from the panel below.</p>
								<div className="mt-6">
									<ImpersonateUserPanel />
								</div>
							</div>
						) : (
							<>
								<MerchantShellBreadcrumb />
								{children}
							</>
						)}
					</MerchantPanelLayout>
				</MerchantBreadcrumbProvider>
			</TenantContextProvider>
		</MerchantAuthorizationProvider>
	);
}
