"use client";

import { useAuth } from "@workspace/client/lib/auth";

import { Button } from "@workspace/ui/components/form/button";
import { usePathname } from "next/navigation";
import * as React from "react";

import { ImpersonationBanner } from "@/components/impersonation/impersonation-banner";
import { AdminBreadcrumbProvider } from "@/components/common/admin-breadcrumb";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import type { FooterAction, SidebarUser } from "@/lib/navigation/sidebar";
import type { SessionPermissionsResponse } from "@workspace/shared";

export interface DashboardShellProps {
	readonly footerActions?: readonly FooterAction[];
	readonly children: React.ReactNode;
	/**
	 * Identity decoded server-side from the access-token JWT (see
	 * `lib/auth-server.ts`), used to paint the real name/email in the SSR HTML.
	 * `GET /auth/me` still runs on the client and supersedes this once it
	 * resolves. `null`/`undefined` falls back to the placeholder.
	 */
	readonly initialUser?: SidebarUser | null;
	readonly initialSessionPermissions?: SessionPermissionsResponse;
}

/**
 * Identity shown in the sidebar/topbar while `GET /auth/me` is still in
 * flight. Rendering the shell immediately — instead of a blocking spinner —
 * means first paint no longer waits for the API round-trip: LCP drops to
 * HTML-paint time. The real identity swaps in as soon as the fetch resolves.
 */
const PLACEHOLDER_USER: SidebarUser = { name: "Account", email: "Loading profile…" };

/**
 * Smart wrapper for every authenticated admin page. Owns the "who am I?"
 * fetch, the error state, and the shared dashboard chrome (`DashboardLayout`).
 * Pages only supply their own content via `children` — they never touch auth
 * or the layout directly.
 *
 * Loading philosophy: the proxy has already confirmed the session server-side
 * (unauthenticated requests never reach this component), so the shell is safe
 * to render while `/auth/me` is in flight. Only a *failed* fetch shows the
 * error screen — a still-loading one renders the full shell with the
 * placeholder identity.
 */
export function DashboardShell({ footerActions = [], children, initialUser = null, initialSessionPermissions }: DashboardShellProps): React.JSX.Element {
	const { api, logout } = useAuth();
	// The breadcrumb provider must wrap EVERY consumer (the layout's own
	// `useTrailDocumentTitle` + `ShellBreadcrumb`), so it lives here — one
	// level above `DashboardLayout` — not inside it.
	const pathname = usePathname();

	// `GET /auth/me` returns the full user record; the shell only needs the
	// sidebar identity shape (name/email). The JWT-decoded `initialUser` covers
	// the SSR paint AND the transient-failure window (e.g. the API still
	// booting after a dev restart): a bumped retry lets the fetch self-heal and
	// refresh roles/permissions without a manual page reload.
	const meQuery = api.auth.me.useQuery(undefined, {
		retry: 5,
		retryDelay: 2000,
	});
	const user = meQuery.data?.data;

	const handleLogout = React.useCallback((): void => {
		void logout();
	}, [logout]);

	// A failed fetch gets the error screen ONLY when there is no identity to
	// fall back to (no `/auth/me` data, no JWT-decoded `initialUser`). The
	// proxy has already validated the session server-side, so a failed fetch
	// here is almost always a transient error (e.g. the API still booting
	// after a dev restart) — the shell keeps rendering with the JWT identity
	// and the 401 → silent-refresh flow still bounces a genuinely dead
	// session. Falling back instead of swapping to a different tree also
	// prevents a hydration mismatch on the first load.
	if (meQuery.error !== null && meQuery.data === undefined && initialUser === null) {
		return (
			<div className="flex min-h-svh items-center justify-center">
				<div className="text-center">
					<p className="text-destructive">Failed to load dashboard</p>
					<p className="mt-2 text-sm text-muted-foreground">Please try logging in again.</p>
					<Button className="mt-4" variant="destructive" onClick={handleLogout}>
						Log out
					</Button>
				</div>
			</div>
		);
	}

	// `GET /auth/me` returns the full user record (with `fullName`); the shell
	// only needs the sidebar identity shape. Precedence: fresh `/auth/me` data
	// > JWT-decoded server identity (SSR paint) > placeholder. So SSR already
	// shows the real user and the fetch simply refreshes roles/perms when done.
	const resolvedUser: SidebarUser = user !== undefined ? { name: user.fullName, email: user.email } : (initialUser ?? PLACEHOLDER_USER);

	return (
		<AdminBreadcrumbProvider pathname={pathname}>
			<ImpersonationBanner />
			<DashboardLayout
				user={{ name: resolvedUser.name, email: resolvedUser.email }}
				onLogout={handleLogout}
				footerActions={footerActions}
				initialSessionPermissions={initialSessionPermissions}
			>
				{children}
			</DashboardLayout>
		</AdminBreadcrumbProvider>
	);
}
