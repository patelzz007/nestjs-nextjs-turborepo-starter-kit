import * as React from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { createAdminServerCaller } from "@/lib/admin-server-api";
import { getServerUser } from "@/lib/auth-server";
import { resolveEnabledFeatureFlags } from "@/lib/feature-flags";
import { prefetch, resolvePrefetchedData } from "@/lib/server/prefetch";

export interface PanelLayoutProps {
	readonly children: React.ReactNode;
}

/**
 * Route-group layout for every authenticated admin page (`/`, `/users/*`,
 * `/settings/*`, `/account/*`, …). A **server component**: it decodes the access-token JWT cookie and hands
 * the real user identity to the client `DashboardShell`, so SSR paints the
 * sidebar/topbar with the actual name/email — no placeholder flash.
 *
 * The session permissions are prefetched too. A failed prefetch is logged and
 * classified: a dead session redirects to login, anything else leaves the
 * client query to load them (the route guard then shows "couldn't load your
 * permissions" with a retry rather than an access-denied page).
 *
 * Rendering `DashboardShell` here — instead of inside each page — keeps the
 * sidebar, topbar, and footer **mounted across navigations**: Next.js only
 * swaps the `children` segment, so navigation is SPA-like and the chrome never
 * resets (search, expand/collapse, and animations all persist).
 */
export default async function PanelLayout({ children }: PanelLayoutProps): Promise<React.JSX.Element> {
	const server = createAdminServerCaller();
	const [initialUser, permissionsResult] = await Promise.all([
		getServerUser(),
		prefetch({ page: "(panel) layout", resource: "session permissions" }, () => server.auth.permissions.query(undefined)),
	]);

	return (
		<DashboardShell initialUser={initialUser} initialSessionPermissions={resolvePrefetchedData(permissionsResult)} enabledFeatureFlags={resolveEnabledFeatureFlags()}>
			{children}
		</DashboardShell>
	);
}
