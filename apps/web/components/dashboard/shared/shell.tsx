"use client";

import type { ServerUser } from "@/contexts/identity/lib/server";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import * as React from "react";

export interface DashboardShellProps {
	readonly children: React.ReactNode;
	readonly initialUser?: ServerUser | null;
	/** Whether the desktop sidebar was open, read by the server from its cookie — the first paint matches it. */
	readonly initialSidebarOpen?: boolean | undefined;
}

/** The customer dashboard's chrome — sidebar, topbar, and command palette. */
export function DashboardShell({ children, initialUser, initialSidebarOpen }: DashboardShellProps): React.JSX.Element {
	return (
		<DashboardLayout initialUser={initialUser} initialSidebarOpen={initialSidebarOpen}>
			{children}
		</DashboardLayout>
	);
}
