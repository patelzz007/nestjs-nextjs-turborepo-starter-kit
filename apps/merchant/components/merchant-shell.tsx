"use client";

import { MerchantBreadcrumbProvider } from "@/components/common/merchant-breadcrumb";
import { MerchantShellBreadcrumb } from "@/components/layout/merchant-shell-breadcrumb";
import { MerchantShellBanners } from "@/components/merchant-shell-banners";
import { ImpersonateUserPanel } from "@/components/impersonation/impersonate-user-panel";
import { MerchantPanelLayout } from "@/components/layout/merchant-panel-layout";
import { useMerchantSidebarControl } from "@/components/layout/use-merchant-sidebar-control";
import { MerchantSidebarPanel } from "@/components/layout/merchant-sidebar-panel";
import { MerchantTopbar } from "@/components/layout/merchant-topbar";
import type { ServerUser } from "@/lib/auth/server";
import { stubApiMeta } from "@/lib/api-envelope";
import { MERCHANT_ME_QUERY_OPTIONS } from "@/lib/session/me-query";
import { MerchantLocationProvider } from "@/lib/org/location-context";
import { useMerchantOrg } from "@/lib/session/root-provider";
import { useAuth } from "@workspace/client/lib/auth";
import type { OrganizationRewardMembershipResponse } from "@workspace/shared";
import { useSidebar as useShellSidebar } from "@workspace/ui/components/navigation/sidebar";
import { isMobileViewport } from "@workspace/ui/hooks/use-mobile";
import { useMerchantCommandPaletteStore } from "@/stores/command-palette-store";
import { useMerchantSidebarStore } from "@/stores/sidebar-store";
import { SidebarPathSync } from "@workspace/client/lib/sidebar/sidebar-path-sync";
import { usePathname } from "next/navigation";
import * as React from "react";

export interface MerchantShellProps {
	readonly children: React.ReactNode;
	readonly initialMemberships?: readonly OrganizationRewardMembershipResponse[];
	readonly initialOrganizationSlug?: string;
	readonly initialUser?: ServerUser | null;
	readonly initialIsImpersonating?: boolean;
}

function MerchantSidebarContent({
	memberships,
	organizationSlug,
	onStoreChange,
}: {
	readonly memberships: readonly OrganizationRewardMembershipResponse[];
	readonly organizationSlug: string | undefined;
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
export function MerchantShell({
	children,
	initialMemberships,
	initialOrganizationSlug,
	initialUser = null,
	initialIsImpersonating = false,
}: MerchantShellProps): React.JSX.Element {
	const { api } = useAuth();
	const pathname = usePathname();
	const { organizationSlug, setOrganizationSlug, syncOrganizationSlug } = useMerchantOrg();
	const { isOpen: sidebarOpen, open: openSidebar, close: closeSidebar } = useMerchantSidebarControl();

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
		() =>
			initialMemberships !== undefined && initialMemberships.length > 0
				? {
						success: true as const,
						data: [...initialMemberships],
						meta: stubApiMeta(),
					}
				: undefined,
		[initialMemberships],
	);

	const membershipsQuery = api.organizations.membershipsBootstrap.useQuery(
		{},
		{
			initialData: initialMeData,
			...MERCHANT_ME_QUERY_OPTIONS,
		},
	);

	const memberships = React.useMemo((): readonly OrganizationRewardMembershipResponse[] => membershipsQuery.data?.data ?? [], [membershipsQuery.data?.data]);

	React.useLayoutEffect((): void => {
		void useMerchantCommandPaletteStore.persist.rehydrate();
		void useMerchantSidebarStore.persist.rehydrate();
	}, []);

	const syncedSlugRef = React.useRef<string | undefined>(undefined);

	React.useEffect((): void => {
		if (initialOrganizationSlug !== undefined) {
			if (syncedSlugRef.current !== initialOrganizationSlug && organizationSlug !== initialOrganizationSlug) {
				syncedSlugRef.current = initialOrganizationSlug;
				syncOrganizationSlug(initialOrganizationSlug);
			}
			return;
		}
		const firstMembership = memberships[0];
		if (firstMembership !== undefined && organizationSlug === undefined && syncedSlugRef.current !== firstMembership.organizationSlug) {
			syncedSlugRef.current = firstMembership.organizationSlug;
			syncOrganizationSlug(firstMembership.organizationSlug);
		}
	}, [initialOrganizationSlug, memberships, organizationSlug, syncOrganizationSlug]);

	const handleStoreChange = React.useCallback(
		(slug: string): void => {
			setOrganizationSlug(slug, { refresh: true });
		},
		[setOrganizationSlug],
	);

	const hasMemberships = memberships.length > 0;
	const showMembershipGate = membershipsQuery.isFetched && !hasMemberships;
	const showMembershipLoading = !hasMemberships && membershipsQuery.isLoading;

	return (
		<MerchantLocationProvider>
			<MerchantBreadcrumbProvider>
				<SidebarPathSync store={useMerchantSidebarStore} />
				<MerchantPanelLayout
					scrollKey={pathname}
					banner={<MerchantShellBanners initialIsImpersonating={initialIsImpersonating} />}
					sidebarOpen={sidebarOpen}
					onSidebarOpenChange={handleSidebarOpenChange}
					sidebar={<MerchantSidebarContent memberships={memberships} organizationSlug={organizationSlug} onStoreChange={handleStoreChange} />}
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
		</MerchantLocationProvider>
	);
}
