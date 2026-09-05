"use client";

import type { ServerUser } from "@/lib/auth-server";
import { RewardHubLayout } from "@/components/layout/reward-hub-layout";
import type { SessionPermissionsResponse } from "@workspace/shared";
import * as React from "react";

export interface RewardHubShellProps {
	readonly children: React.ReactNode;
	readonly initialUser?: ServerUser | null;
	readonly sessionActive?: boolean;
	readonly initialSessionPermissions?: SessionPermissionsResponse;
}

/** Consumer Reward Hub chrome — sidebar, topbar, and command palette. */
export function RewardHubShell({
	children,
	initialUser,
	sessionActive = false,
	initialSessionPermissions,
}: RewardHubShellProps): React.JSX.Element {
	return (
		<RewardHubLayout initialUser={initialUser} sessionActive={sessionActive} initialSessionPermissions={initialSessionPermissions}>
			{children}
		</RewardHubLayout>
	);
}
