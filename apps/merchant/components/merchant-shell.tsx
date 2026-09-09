"use client";

import { MerchantBreadcrumbProvider } from "@/components/common/merchant-breadcrumb";
import { MerchantShellBreadcrumb } from "@/components/layout/merchant-shell-breadcrumb";
import { ImpersonationBanner } from "@/components/impersonation/impersonation-banner";
import { ImpersonateUserPanel } from "@/components/impersonation/impersonate-user-panel";
import { useMerchantSidebarControl } from "@/components/layout/use-merchant-sidebar-control";
import { MerchantSidebarPanel } from "@/components/layout/merchant-sidebar-panel";
import { MerchantTopbar } from "@/components/layout/merchant-topbar";
import type { ServerUser } from "@/lib/auth-server";
import { stubApiMeta } from "@/lib/api-envelope";
import { MERCHANT_ME_QUERY_OPTIONS } from "@/lib/merchant-me-query";
import { useMerchantOrg } from "@/lib/merchant-root-provider";
import { useAuth } from "@workspace/client/lib/auth";
import type { MerchantMembershipResponse } from "@workspace/shared";
import { AppPanelShell } from "@workspace/ui/components/navigation/app-panel-shell";
import { useSidebar as useShellSidebar } from "@workspace/ui/components/navigation/sidebar";
import { isMobileViewport } from "@workspace/ui/hooks/use-mobile";
import { useMerchantCommandPaletteStore } from "@/stores/command-palette-store";
import { useMerchantSidebarStore } from "@/stores/sidebar-store";
import { SidebarPathSync } from "@workspace/client/lib/sidebar/sidebar-path-sync";
import * as React from "react";

export interface MerchantShellProps {
	readonly children: React.ReactNode;
	readonly initialMemberships?: readonly MerchantMembershipResponse[];
	readonly initialMerchantOrgId?: string;
	readonly initialUser?: ServerUser | null;
	readonly initialIsImpersonating?: boolean;
}

function MerchantSidebarContent({
	memberships,
	merchantOrgId,
	onStoreChange,
}: {
	readonly memberships: readonly MerchantMembershipResponse[];
	readonly merchantOrgId: string | undefined;
	readonly onStoreChange: (orgId: string) => void;
}): React.JSX.Element {
	const { setOpenMobile } = useShellSidebar();

	const handleNavigate = React.useCallback((): void => {
		if (isMobileViewport()) {
			setOpenMobile(false);
		}
	}, [setOpenMobile]);

	return <MerchantSidebarPanel memberships={memberships} merchantOrgId={merchantOrgId} onStoreChange={onStoreChange} onNavigate={handleNavigate} />;
}

/** Merchant portal chrome — custom sidebar + topbar with command palette. */
export function MerchantShell({
	children,
	initialMemberships,
	initialMerchantOrgId,
	initialUser = null,
	initialIsImpersonating = false,
}: MerchantShellProps): React.JSX.Element {
	const { api } = useAuth();
	const { merchantOrgId, setMerchantOrgId } = useMerchantOrg();
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

	const membershipsQuery = api.merchant.me.useQuery(
		{},
		{
			initialData: initialMeData,
			...MERCHANT_ME_QUERY_OPTIONS,
		},
	);

	const memberships = React.useMemo((): readonly MerchantMembershipResponse[] => membershipsQuery.data?.data ?? [], [membershipsQuery.data?.data]);

	React.useLayoutEffect((): void => {
		void useMerchantCommandPaletteStore.persist.rehydrate();
		void useMerchantSidebarStore.persist.rehydrate();
	}, []);

	const syncedOrgRef = React.useRef<string | undefined>(undefined);

	React.useEffect((): void => {
		if (initialMerchantOrgId !== undefined) {
			if (syncedOrgRef.current !== initialMerchantOrgId && merchantOrgId !== initialMerchantOrgId) {
				syncedOrgRef.current = initialMerchantOrgId;
				setMerchantOrgId(initialMerchantOrgId);
			}
			return;
		}
		const firstMembership = memberships[0];
		if (firstMembership !== undefined && merchantOrgId === undefined && syncedOrgRef.current !== firstMembership.merchantOrgId) {
			syncedOrgRef.current = firstMembership.merchantOrgId;
			setMerchantOrgId(firstMembership.merchantOrgId);
		}
	}, [initialMerchantOrgId, memberships, merchantOrgId, setMerchantOrgId]);

	const handleStoreChange = React.useCallback(
		(orgId: string): void => {
			setMerchantOrgId(orgId, { refresh: true });
		},
		[setMerchantOrgId],
	);

	const hasMemberships = memberships.length > 0;
	const showMembershipGate = membershipsQuery.isFetched && !hasMemberships;
	const showMembershipLoading = !hasMemberships && membershipsQuery.isLoading;

	return (
		<MerchantBreadcrumbProvider>
			<SidebarPathSync store={useMerchantSidebarStore} />
			<AppPanelShell
				shellClassName="merchant-app"
				banner={<ImpersonationBanner initialIsImpersonating={initialIsImpersonating} />}
				sidebarOpen={sidebarOpen}
				onSidebarOpenChange={handleSidebarOpenChange}
				sidebar={<MerchantSidebarContent memberships={memberships} merchantOrgId={merchantOrgId} onStoreChange={handleStoreChange} />}
				topbar={<MerchantTopbar initialUser={initialUser} />}
				contentClassName="space-y-6">
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
			</AppPanelShell>
		</MerchantBreadcrumbProvider>
	);
}
