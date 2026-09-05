import * as React from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { createAdminServerCaller } from "@/lib/admin-server-api";
import { getServerUser } from "@/lib/auth-server";
import { CapabilityMenuResponseSchema, SessionPermissionsResponseSchema, type CapabilityMenuResponse, type SessionPermissionsResponse } from "@workspace/shared";

export interface PanelLayoutProps {
	readonly children: React.ReactNode;
}

async function loadInitialNavigationMenu(server: ReturnType<typeof createAdminServerCaller>): Promise<CapabilityMenuResponse | undefined> {
	try {
		const response = await server.navigation.menu.query({ scope: "ADMIN" });
		const parsed = CapabilityMenuResponseSchema.safeParse(response.data);
		if (parsed.success) {
			return parsed.data;
		}
	} catch {
		return undefined;
	}
	return undefined;
}

async function loadInitialSessionPermissions(server: ReturnType<typeof createAdminServerCaller>): Promise<SessionPermissionsResponse | undefined> {
	try {
		const response = await server.auth.permissions.query(undefined);
		const parsed = SessionPermissionsResponseSchema.safeParse(response.data);
		if (parsed.success) {
			return parsed.data;
		}
	} catch {
		return undefined;
	}
	return undefined;
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
	const server = createAdminServerCaller();
	const [initialUser, initialNavigationMenu, initialSessionPermissions] = await Promise.all([
		getServerUser(),
		loadInitialNavigationMenu(server),
		loadInitialSessionPermissions(server),
	]);

	return (
		<DashboardShell initialUser={initialUser} initialNavigationMenu={initialNavigationMenu} initialSessionPermissions={initialSessionPermissions}>
			{children}
		</DashboardShell>
	);
}
