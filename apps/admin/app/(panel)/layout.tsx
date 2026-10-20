import { readSidebarOpenCookie } from "@workspace/client/lib/features/sidebar/open-cookie";
import { cookies } from "next/headers";
import * as React from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getServerUser, loadAdminServerSession } from "@/lib/auth-server";
import { serverEnv } from "@/lib/env/env.server";
import { resolveEnabledFeatureFlags } from "@/lib/feature-flags";
import { loadMerchantInvitingOffered } from "@/lib/server/merchant-invite-availability";
import { ADMIN_SIDEBAR_STORAGE_KEY } from "@/lib/navigation/sidebar-menu";
import { ROUTES } from "@/lib/routes";
import { redirect } from "next/navigation";

export interface PanelLayoutProps {
	readonly children: React.ReactNode;
}

/**
 * Route-group layout for every authenticated admin page (`/`, `/users/*`,
 * `/settings/*`, `/account/*`, …). A **server component**: it decodes the access-token JWT cookie and hands
 * the real user identity to the client `DashboardShell`, so SSR paints the
 * sidebar/topbar with the actual name/email — no placeholder flash — and
 * reads the sidebar's open state from its cookie, so a collapsed sidebar is
 * collapsed in the first paint (no open-then-close flash).
 *
 * The session permissions come from the request's session answer
 * (`loadAdminServerSession`, shared with the root layout). A dead session
 * redirects to login; an unavailable API leaves the client query to load them
 * (the route guard then shows "couldn't load your permissions" with a retry
 * rather than an access-denied page).
 *
 * Rendering `DashboardShell` here — instead of inside each page — keeps the
 * sidebar, topbar, and footer **mounted across navigations**: Next.js only
 * swaps the `children` segment, so navigation is SPA-like and the chrome never
 * resets (search, expand/collapse, and animations all persist).
 */
export default async function PanelLayout({ children }: PanelLayoutProps): Promise<React.JSX.Element> {
	// The same per-request answer the root layout started the auth store from.
	const [initialUser, session, cookieStore, merchantInvitesOffered] = await Promise.all([getServerUser(), loadAdminServerSession(), cookies(), loadMerchantInvitingOffered()]);
	if (session.kind === "signed-out") {
		redirect(ROUTES.auth.login);
	}

	return (
		<DashboardShell
			initialUser={initialUser}
			initialSessionPermissions={session.kind === "signed-in" ? session.session.permissions : undefined}
			enabledFeatureFlags={resolveEnabledFeatureFlags(serverEnv, { merchantInvitesOffered })}
			initialSidebarOpen={readSidebarOpenCookie(cookieStore, ADMIN_SIDEBAR_STORAGE_KEY)}>
			{children}
		</DashboardShell>
	);
}
