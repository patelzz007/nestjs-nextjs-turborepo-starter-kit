"use client";

import type { ServerUser } from "@/lib/auth-server";
import { toAuthUser } from "@/lib/map-auth-user";
import { ImpersonationBanner } from "@/components/impersonation/impersonation-banner";
import { useWebSidebarControl } from "@/components/layout/use-web-sidebar-control";
import { WebSidebarPanel } from "@/components/layout/web-sidebar-panel";
import { WebShellBreadcrumb } from "@/components/layout/web-shell-breadcrumb";
import { RewardHubTopbar } from "@/components/layout/reward-hub-topbar";
import { useAuth } from "@workspace/client/lib/auth";
import { AppPanelShell } from "@workspace/ui/components/navigation/app-panel-shell";
import { useSidebar as useShellSidebar } from "@workspace/ui/components/navigation/sidebar";
import { isMobileViewport } from "@workspace/ui/hooks/use-mobile";
import { useWebCommandPaletteStore } from "@/stores/command-palette-store";
import { useWebSidebarStore } from "@/stores/sidebar-store";
import { SidebarPathSync } from "@workspace/client/lib/sidebar/sidebar-path-sync";
import * as React from "react";

export interface RewardHubLayoutProps {
	readonly children: React.ReactNode;
	readonly initialUser?: ServerUser | null;
	readonly sessionActive?: boolean;
}

function RewardHubSidebarContent({ userName, sessionActive }: { readonly userName: string | null; readonly sessionActive: boolean }): React.JSX.Element {
	const { setOpenMobile } = useShellSidebar();

	const handleNavigate = React.useCallback((): void => {
		if (isMobileViewport()) {
			setOpenMobile(false);
		}
	}, [setOpenMobile]);

	return <WebSidebarPanel userName={userName} sessionActive={sessionActive} onNavigate={handleNavigate} />;
}

/** Consumer shell — custom sidebar + topbar with command palette. */
export function RewardHubLayout({ children, initialUser = null, sessionActive = false }: RewardHubLayoutProps): React.JSX.Element {
	const { user, login, api } = useAuth();
	const { isOpen: sidebarOpen, open: openSidebar, close: closeSidebar } = useWebSidebarControl();

	const meQuery = api.auth.me.useQuery(undefined, {
		enabled: sessionActive && user === null,
		retry: false,
	});

	React.useEffect((): void => {
		const profile = meQuery.data?.data;
		if (profile === undefined) {
			return;
		}
		login(toAuthUser(profile));
	}, [login, meQuery.data?.data]);

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

	React.useEffect((): void => {
		void useWebCommandPaletteStore.persist.rehydrate();
		void useWebSidebarStore.persist.rehydrate();
	}, []);

	const sidebarUserName = user?.fullName ?? initialUser?.name ?? null;

	return (
		<AppPanelShell
			shellClassName="web-app"
			banner={<ImpersonationBanner sessionActive={sessionActive} />}
			sidebarOpen={sidebarOpen}
			onSidebarOpenChange={handleSidebarOpenChange}
			sidebar={<RewardHubSidebarContent userName={sidebarUserName} sessionActive={sessionActive} />}
			topbar={<RewardHubTopbar />}>
			<SidebarPathSync store={useWebSidebarStore} />
			<WebShellBreadcrumb />
			{children}
		</AppPanelShell>
	);
}
