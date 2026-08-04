"use client";

import { useAuth } from "@workspace/client/lib/auth";
import { authEndpoints } from "@workspace/client/lib/endpoints";
import { Button } from "@workspace/ui/components/button";
import { usePathname } from "next/navigation";
import * as React from "react";

import { AdminBreadcrumbProvider } from "@/components/common/admin-breadcrumb";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import type { FooterAction } from "@/types/sidebar";

export interface DashboardShellProps {
	readonly footerActions?: readonly FooterAction[];
	readonly children: React.ReactNode;
}

/**
 * Smart wrapper for every authenticated admin page. Owns the "who am I?"
 * fetch, the loading / error states, and the shared dashboard chrome
 * (`DashboardLayout`). Pages only supply their own content via `children` —
 * they never touch auth or the layout directly.
 */ export function DashboardShell({ footerActions = [], children }: DashboardShellProps): React.JSX.Element {
	const { api, isInitializing, logout } = useAuth();
	// The breadcrumb provider must wrap EVERY consumer (the layout's own
	// `useTrailDocumentTitle` + `ShellBreadcrumb`), so it lives here — one
	// level above `DashboardLayout` — not inside it. The hook is called before
	// any early return (rules of hooks).
	const pathname = usePathname();

	const meQuery = api.procedure(authEndpoints.me).useQuery();
	const user = meQuery.data?.data;

	const handleLogout = React.useCallback((): void => {
		void logout();
	}, [logout]);

	// On SSR + the first client render, auth state isn't established yet — render
	// the hydration spinner instead of flashing the query states (mirrors the
	// isInitializing gate on the login pages / hello page). This single gate
	// covers every admin panel page, since DashboardShell wraps them all.
	if (isInitializing) {
		return (
			<div className="flex min-h-svh items-center justify-center">
				<div className="flex flex-col items-center gap-4">
					<svg className="size-8 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24" aria-hidden="true">
						<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
						<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
					</svg>
					<p className="text-sm text-muted-foreground">Loading…</p>
				</div>
			</div>
		);
	}

	if (meQuery.isLoading) {
		return (
			<div className="flex min-h-svh items-center justify-center">
				<div className="flex flex-col items-center gap-4">
					<svg className="size-8 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24" aria-hidden="true">
						<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
						<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
					</svg>
					<p className="text-sm text-muted-foreground">Loading dashboard...</p>
				</div>
			</div>
		);
	}

	if (meQuery.error !== null || user === undefined) {
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

	return (
		<AdminBreadcrumbProvider pathname={pathname}>
			<DashboardLayout user={{ name: user.fullName, email: user.email }} onLogout={handleLogout} footerActions={footerActions}>
				{children}
			</DashboardLayout>
		</AdminBreadcrumbProvider>
	);
}
