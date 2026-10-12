"use client";

import type { ServerUser } from "@/lib/auth/server";
import { RewardHubLayout } from "@/components/layout/reward-hub-layout";
import * as React from "react";

export interface RewardHubShellProps {
	readonly children: React.ReactNode;
	readonly initialUser?: ServerUser | null;
	/** Whether the desktop sidebar was open, read by the server from its cookie — the first paint matches it. */
	readonly initialSidebarOpen?: boolean | undefined;
}

/** Consumer Reward Hub chrome — sidebar, topbar, and command palette. */
export function RewardHubShell({ children, initialUser, initialSidebarOpen }: RewardHubShellProps): React.JSX.Element {
	return (
		<RewardHubLayout initialUser={initialUser} initialSidebarOpen={initialSidebarOpen}>
			{children}
		</RewardHubLayout>
	);
}
