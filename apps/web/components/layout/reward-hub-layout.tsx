"use client";

import type { ServerUser } from "@/lib/auth/server";
import { WebRouteAccessGuard } from "@/components/auth/route-access-guard";
import { ImpersonationBanner } from "@/components/impersonation/impersonation-banner";
import { WebSidebarPanel } from "@/components/layout/web-sidebar-panel";
import { WebShellBreadcrumb } from "@/components/layout/web-shell-breadcrumb";
import { RewardHubTopbar } from "@/components/layout/reward-hub-topbar";
import { useAuthUser } from "@workspace/client/lib/auth";
import { SessionCheckNotice } from "@workspace/client/lib/auth/session/session-check-notice";
import { AppPanelShell } from "@workspace/ui/components/app-panel-shell";
import { WEB_COMMAND_PALETTE_DEVTOOLS_NAME, WEB_COMMAND_PALETTE_STORAGE_KEY } from "@/lib/palette/store-config";
import { WEB_SIDEBAR_DEVTOOLS_NAME, WEB_SIDEBAR_STORAGE_KEY } from "@/lib/navigation/sidebar-menu";
import { CommandPaletteStoreProvider } from "@workspace/client/lib/features/command-palette/facade";
import { SidebarStoreProvider, useSidebarCommands, useSidebarIsOpen } from "@workspace/client/lib/features/sidebar/facade";
import { usePathname } from "next/navigation";
import * as React from "react";

export interface RewardHubLayoutProps {
	readonly children: React.ReactNode;
	readonly initialUser?: ServerUser | null | undefined;
}

/**
 * Consumer shell — custom sidebar + topbar with command palette. Capabilities
 * come from the root `WebAuthorizationProvider`; `WebRouteAccessGuard` applies
 * each page's capability rule from `WEB_ROUTE_ACCESS`, the same table that
 * filters the sidebar and the command palette.
 */
export function RewardHubLayout(props: RewardHubLayoutProps): React.JSX.Element {
	const authUser = useAuthUser();
	return (
		<SidebarStoreProvider storageKey={WEB_SIDEBAR_STORAGE_KEY} devtoolsName={WEB_SIDEBAR_DEVTOOLS_NAME}>
			<CommandPaletteStoreProvider storageKey={WEB_COMMAND_PALETTE_STORAGE_KEY} ownerId={authUser?.id ?? null} devtoolsName={WEB_COMMAND_PALETTE_DEVTOOLS_NAME}>
				<RewardHubShell {...props} />
			</CommandPaletteStoreProvider>
		</SidebarStoreProvider>
	);
}

function RewardHubShell({ children, initialUser = null }: RewardHubLayoutProps): React.JSX.Element {
	// The session check in the root `AuthProvider` restores the profile; the
	// shell only reads it (the server-decoded `initialUser` covers first paint).
	const user = useAuthUser();
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

	const sidebarUserName = user?.fullName ?? initialUser?.name ?? null;
	const pathname = usePathname();

	return (
		<AppPanelShell
			shellClassName="web-app"
			scrollResetKey={pathname}
			banner={
				<>
					<ImpersonationBanner />
					<SessionCheckNotice />
				</>
			}
			sidebarOpen={sidebarOpen}
			onSidebarOpenChange={handleSidebarOpenChange}
			sidebar={<WebSidebarPanel userName={sidebarUserName} />}
			topbar={<RewardHubTopbar />}>
			<WebShellBreadcrumb />
			<WebRouteAccessGuard>{children}</WebRouteAccessGuard>
		</AppPanelShell>
	);
}
