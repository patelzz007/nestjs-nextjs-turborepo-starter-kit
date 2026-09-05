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
import { MERCHANT_ME_QUERY_KEY } from "@workspace/client/lib/auth/invalidate-session-auth";
import { useMerchantOrg } from "@/lib/merchant-root-provider";
import { useAuth } from "@workspace/client/lib/auth";
import type { MerchantMembershipResponse } from "@workspace/shared";
import { AppPanelShell } from "@workspace/ui/components/navigation/app-panel-shell";
import { useSidebar as useShellSidebar } from "@workspace/ui/components/navigation/sidebar";
import { isMobileViewport } from "@workspace/ui/hooks/use-mobile";
import { useMerchantCommandPaletteStore } from "@/stores/command-palette-store";
import { useMerchantSidebarStore } from "@/stores/sidebar-store";
import { SidebarPathSync } from "@workspace/client/lib/sidebar/sidebar-path-sync";
import { useQueryClient } from "@tanstack/react-query";
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
	const queryClient = useQueryClient();
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
			initialMemberships !== undefined
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
			staleTime: 0,
		},
	);

	const memberships = React.useMemo((): readonly MerchantMembershipResponse[] => membershipsQuery.data?.data ?? [], [membershipsQuery.data?.data]);

	React.useEffect((): void => {
		if (initialMemberships === undefined) {
			return;
		}
		queryClient.setQueryData(MERCHANT_ME_QUERY_KEY, {
			success: true as const,
			data: [...initialMemberships],
			meta: stubApiMeta(),
		});
	}, [initialMemberships, queryClient]);

	React.useLayoutEffect((): void => {
		void useMerchantCommandPaletteStore.persist.rehydrate();
		void useMerchantSidebarStore.persist.rehydrate();
	}, []);

	React.useEffect((): void => {
		if (initialMerchantOrgId !== undefined) {
			if (merchantOrgId !== initialMerchantOrgId) {
				setMerchantOrgId(initialMerchantOrgId);
			}
			return;
		}
		const firstMembership = memberships[0];
		if (merchantOrgId === undefined && firstMembership !== undefined) {
			setMerchantOrgId(firstMembership.merchantOrgId);
		}
	}, [initialMerchantOrgId, memberships, merchantOrgId, setMerchantOrgId]);

	const handleStoreChange = React.useCallback(
		(orgId: string): void => {
			setMerchantOrgId(orgId);
		},
		[setMerchantOrgId],
	);

	const hasMemberships = memberships.length > 0;
	const showMembershipGate = initialMemberships !== undefined ? !hasMemberships : membershipsQuery.isSuccess && !hasMemberships;

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
				{membershipsQuery.isLoading && initialMemberships === undefined ? <p className="text-sm text-muted-foreground">Loading merchant access…</p> : null}
				{showMembershipGate ? (
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
