import { RewardHubShell } from "@/components/rewardhub/shared/shell";
import { getServerUser } from "@/lib/auth/server";
import { WEB_SIDEBAR_STORAGE_KEY } from "@/lib/navigation/sidebar-menu";
import { readSidebarOpenCookie } from "@workspace/client/lib/features/sidebar/open-cookie";
import { cookies } from "next/headers";
import * as React from "react";

export const dynamic = "force-dynamic";

/** Capabilities come from the root `WebAuthorizationProvider` — this layout only adds the shell. */
export default async function RewardHubLayout({ children }: { readonly children: React.ReactNode }): Promise<React.JSX.Element> {
	const [initialUser, cookieStore] = await Promise.all([getServerUser(), cookies()]);

	// The sidebar's open state comes from its cookie, so a collapsed sidebar is collapsed in the first paint.
	return (
		<RewardHubShell initialUser={initialUser} initialSidebarOpen={readSidebarOpenCookie(cookieStore, WEB_SIDEBAR_STORAGE_KEY)}>
			{children}
		</RewardHubShell>
	);
}
