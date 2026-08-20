import * as React from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getServerUser } from "@/lib/auth-server";

export interface PanelLayoutProps {
	readonly children: React.ReactNode;
}

/**
 * Route-group layout for every authenticated admin page (`/`, `/settings/*`,
 * …). A **server component**: it decodes the access-token JWT cookie and hands
 * the real user identity to the client `DashboardShell`, so SSR paints the
 * sidebar/topbar with the actual name/email — no placeholder flash.
 *
 * Rendering `DashboardShell` here — instead of inside each page — keeps the
 * sidebar, topbar, and footer **mounted across navigations**: Next.js only
 * swaps the `children` segment, so navigation is SPA-like and the chrome never
 * resets (search, expand/collapse, and animations all persist).
 */
export default async function PanelLayout({ children }: PanelLayoutProps): Promise<React.JSX.Element> {
	const initialUser = await getServerUser();

	return <DashboardShell initialUser={initialUser}>{children}</DashboardShell>;
}
