"use client";

import type { ServerUser } from "@/contexts/identity/lib/server";
import { WebRouteAccessGuard } from "@/contexts/identity/components/route-access-guard";
import { ImpersonationBanner } from "@/components/impersonation/impersonation-banner";
import { WebSidebarPanel } from "@/components/layout/web-sidebar-panel";
import { WebTopbar } from "@/components/layout/web-topbar";
import { useAuthUser } from "@workspace/client/lib/contexts/identity";
import { SessionCheckNotice } from "@workspace/client/lib/contexts/identity/session/session-check-notice";
import { StoreBoundAppPanelShell } from "@workspace/client/lib/features/sidebar/store-bound-panel-shell";
import { WEB_COMMAND_PALETTE_DEVTOOLS_NAME, WEB_COMMAND_PALETTE_STORAGE_KEY } from "@/lib/palette/store-config";
import { WEB_SIDEBAR_DEVTOOLS_NAME, WEB_SIDEBAR_STORAGE_KEY } from "@/lib/navigation/sidebar-menu";
import { CommandPaletteStoreProvider } from "@workspace/client/lib/features/command-palette/facade";
import { SidebarStoreProvider } from "@workspace/client/lib/features/sidebar/facade";
import { usePathname } from "next/navigation";
import * as React from "react";

export interface DashboardLayoutProps {
	readonly children: React.ReactNode;
	readonly initialUser?: ServerUser | null | undefined;
	/** Whether the desktop sidebar was open, read by the server from its cookie — the first paint matches it. */
	readonly initialSidebarOpen?: boolean | undefined;
}

/**
 * Consumer shell — custom sidebar + topbar with command palette. Capabilities
 * come from the root `WebAuthorizationProvider`; `WebRouteAccessGuard` applies
 * each page's capability rule from `WEB_ROUTE_ACCESS`, the same table that
 * filters the sidebar and the command palette.
 */
export function DashboardLayout(props: DashboardLayoutProps): React.JSX.Element {
	const authUser = useAuthUser();
	return (
		<SidebarStoreProvider storageKey={WEB_SIDEBAR_STORAGE_KEY} devtoolsName={WEB_SIDEBAR_DEVTOOLS_NAME} initialIsOpen={props.initialSidebarOpen}>
			<CommandPaletteStoreProvider storageKey={WEB_COMMAND_PALETTE_STORAGE_KEY} ownerId={authUser?.id ?? null} devtoolsName={WEB_COMMAND_PALETTE_DEVTOOLS_NAME}>
				<DashboardShell {...props} />
			</CommandPaletteStoreProvider>
		</SidebarStoreProvider>
	);
}

function DashboardShell({ children, initialUser = null }: DashboardLayoutProps): React.JSX.Element {
	// The session check in the root `AuthProvider` restores the profile; the
	// shell only reads it (the server-decoded `initialUser` covers first paint).
	const user = useAuthUser();
	const sidebarUserName = user?.fullName ?? initialUser?.name ?? null;
	const pathname = usePathname();

	return (
		<StoreBoundAppPanelShell
			shellClassName="web-app"
			scrollResetKey={pathname}
			banner={
				<>
					<ImpersonationBanner />
					<SessionCheckNotice />
				</>
			}
			sidebar={<WebSidebarPanel userName={sidebarUserName} />}
			topbar={<WebTopbar />}>
			<WebRouteAccessGuard>{children}</WebRouteAccessGuard>
		</StoreBoundAppPanelShell>
	);
}
