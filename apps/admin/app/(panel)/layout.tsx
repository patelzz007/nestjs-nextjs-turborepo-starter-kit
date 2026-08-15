import { PrefetchBoundary } from "@workspace/client/lib/api/prefetch-boundary";
import { prefetchPage } from "@workspace/client/lib/api/server-api";

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
 * The shell's `api.auth.me` query (which runs on EVERY panel page) is
 * prefetched here and hydrated through `PrefetchBoundary`, so the identity
 * fetch is one server-side call per request instead of a client round-trip on
 * each page. When the prefetch fails (no cookie / API down) it is simply not
 * dehydrated — the shell's own `useQuery` (with its 401 → silent-refresh and
 * retry pipeline) takes over, exactly as before.
 *
 * Rendering `DashboardShell` here — instead of inside each page — keeps the
 * sidebar, topbar, and footer **mounted across navigations**: Next.js only
 * swaps the `children` segment, so navigation is SPA-like and the chrome never
 * resets (search, expand/collapse, and animations all persist).
 */
export default async function PanelLayout({ children }: PanelLayoutProps): Promise<React.JSX.Element> {
	const [initialUser, { state, report }] = await Promise.all([getServerUser(), prefetchPage((server) => [server.auth.me(undefined)])]);

	return (
		<PrefetchBoundary state={state} report={report}>
			<DashboardShell initialUser={initialUser}>{children}</DashboardShell>
		</PrefetchBoundary>
	);
}
