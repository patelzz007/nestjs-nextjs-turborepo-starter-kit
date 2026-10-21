"use client";

import { MerchantAuthorizationProvider } from "@/contexts/tenancy/components/access/merchant-authorization-provider";
import { SWITCHER_MEMBERSHIPS_QUERY } from "@/contexts/tenancy/lib/tenant/memberships-query";
import { MerchantAccessLoading } from "@/contexts/tenancy/components/access/merchant-capability-gate";
import { lifecycleScreenStateOf, TenantLifecycleScreen } from "@/contexts/tenancy/components/lifecycle/tenant-lifecycle-screen";
import { MerchantBreadcrumbProvider } from "@/components/common/merchant-breadcrumb";
import { MerchantShellBanners } from "@/components/merchant-shell-banners";
import { ImpersonateUserPanel } from "@/components/impersonation/impersonate-user-panel";
import { MerchantSidebarPanel } from "@/components/layout/merchant-sidebar-panel";
import { MerchantTopbar } from "@/components/layout/merchant-topbar";
import type { ServerUser } from "@/contexts/identity/lib/server";
import { initialDataOption, readPaginatedHasNext, readPaginatedTotal } from "@workspace/client/lib/api/envelope";
import { MERCHANT_ME_QUERY_OPTIONS } from "@/lib/session/me-query";
import { TenantContextProvider, TenantRequestScope } from "@/features/tenant-context/facade";
import { useSwitchTenant } from "@/contexts/tenancy/lib/tenant/use-switch-tenant";
import { useAuth, useAuthUser } from "@workspace/client/lib/contexts/identity";
import type { Envelope, TenantContextResponse, TenantRewardMembershipResponse } from "@workspace/shared";
import { StoreBoundAppPanelShell } from "@workspace/client/lib/features/sidebar/store-bound-panel-shell";
import { MERCHANT_COMMAND_PALETTE_DEVTOOLS_NAME, MERCHANT_COMMAND_PALETTE_STORAGE_KEY } from "@/lib/palette/store-config";
import { CommandPaletteStoreProvider } from "@workspace/client/lib/features/command-palette/facade";
import { MERCHANT_SIDEBAR_DEVTOOLS_NAME, MERCHANT_SIDEBAR_STORAGE_KEY } from "@/lib/navigation/sidebar-menu";
import { SidebarStoreProvider } from "@workspace/client/lib/features/sidebar/facade";
import { MERCHANT_UI_PREFERENCES_DEVTOOLS_NAME, MERCHANT_UI_PREFERENCES_STORAGE_KEY } from "@/lib/ui-preferences/store-config";
import { UiPreferencesStoreProvider } from "@workspace/client/lib/features/ui-preferences/facade";
import { usePathname } from "next/navigation";
import * as React from "react";

export interface MerchantShellProps {
	readonly children: React.ReactNode;
	/** The `[tenantSlug]` URL segment — the active tenant (the URL owns it). */
	readonly tenantSlug: string;
	/** The member's store choice as the server read it from the `tenantLocationId` cookie. */
	readonly initialLocationId: string | null;
	/** Tenant context the server loaded — seeds the tenant context's accessible locations. */
	readonly initialTenantContext?: Envelope<TenantContextResponse> | undefined;
	/** The first page of memberships the server listed — the API's own envelope (real meta), seeding the client query. */
	readonly initialMemberships?: Envelope<TenantRewardMembershipResponse[]> | undefined;
	readonly initialUser?: ServerUser | null;
	readonly initialIsImpersonating?: boolean;
	/** Whether the desktop sidebar was open, read by the server from its cookie — the first paint matches it. */
	readonly initialSidebarOpen?: boolean | undefined;
}

/** Merchant portal chrome — custom sidebar + topbar with command palette. */
export function MerchantShell(props: MerchantShellProps): React.JSX.Element {
	const authUser = useAuthUser();
	return (
		<SidebarStoreProvider storageKey={MERCHANT_SIDEBAR_STORAGE_KEY} devtoolsName={MERCHANT_SIDEBAR_DEVTOOLS_NAME} initialIsOpen={props.initialSidebarOpen}>
			<CommandPaletteStoreProvider storageKey={MERCHANT_COMMAND_PALETTE_STORAGE_KEY} ownerId={authUser?.id ?? null} devtoolsName={MERCHANT_COMMAND_PALETTE_DEVTOOLS_NAME}>
				<UiPreferencesStoreProvider storageKey={MERCHANT_UI_PREFERENCES_STORAGE_KEY} devtoolsName={MERCHANT_UI_PREFERENCES_DEVTOOLS_NAME}>
					<MerchantShellContent {...props} />
				</UiPreferencesStoreProvider>
			</CommandPaletteStoreProvider>
		</SidebarStoreProvider>
	);
}

function MerchantShellContent({
	children,
	tenantSlug,
	initialLocationId,
	initialTenantContext,
	initialMemberships,
	initialUser = null,
	initialIsImpersonating = false,
}: MerchantShellProps): React.JSX.Element {
	const { api } = useAuth();
	const pathname = usePathname();
	const switchTenant = useSwitchTenant();

	const membershipsQuery = api.tenants.membershipsBootstrap.useQuery(SWITCHER_MEMBERSHIPS_QUERY, {
		...initialDataOption(initialMemberships),
		...MERCHANT_ME_QUERY_OPTIONS,
	});

	const memberships = React.useMemo((): readonly TenantRewardMembershipResponse[] => membershipsQuery.data?.data ?? [], [membershipsQuery.data?.data]);
	// Counted by the API over every page: the switcher shows the first page, the stores page the rest.
	const membershipCount = readPaginatedTotal(membershipsQuery.data?.meta, memberships.length);
	const hasMoreStores = readPaginatedHasNext(membershipsQuery.data?.meta);

	const hasMemberships = membershipCount > 0;
	const showMembershipGate = membershipsQuery.isFetched && !hasMemberships;
	const showMembershipLoading = !hasMemberships && membershipsQuery.isLoading;
	// A suspended or pending-deletion tenant serves only its lifecycle routes (C1): its screen replaces every page.
	const activeMembership = memberships.find((membership) => membership.tenantSlug === tenantSlug);
	const lifecycleScreen = lifecycleScreenStateOf(activeMembership) === null ? undefined : activeMembership;

	return (
		<TenantContextProvider tenantSlug={tenantSlug} initialLocationId={initialLocationId} initialTenantContext={initialTenantContext}>
			<TenantRequestScope />
			<MerchantAuthorizationProvider>
				<MerchantBreadcrumbProvider>
					<StoreBoundAppPanelShell
						shellClassName="merchant-panel-shell"
						contentClassName="space-y-6"
						scrollResetKey={pathname}
						banner={<MerchantShellBanners initialIsImpersonating={initialIsImpersonating} />}
						sidebar={
							<MerchantSidebarPanel memberships={memberships} hasMoreStores={hasMoreStores} tenantSlug={tenantSlug} onStoreChange={switchTenant} initialUser={initialUser} />
						}
						topbar={<MerchantTopbar />}>
						{showMembershipLoading ? (
							<MerchantAccessLoading />
						) : lifecycleScreen !== undefined ? (
							<TenantLifecycleScreen membership={lifecycleScreen} />
						) : showMembershipGate ? (
							<div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
								<p className="text-sm font-medium text-foreground">No merchant membership found</p>
								<p className="mt-2 text-sm text-muted-foreground">Ask an admin for an invite, or impersonate a merchant owner from the panel below.</p>
								<div className="mt-6">
									<ImpersonateUserPanel />
								</div>
							</div>
						) : (
							children
						)}
					</StoreBoundAppPanelShell>
				</MerchantBreadcrumbProvider>
			</MerchantAuthorizationProvider>
		</TenantContextProvider>
	);
}
