import { RewardHubShell } from "@/components/rewardhub/reward-hub-shell";
import { getServerUser, hasServerSession } from "@/lib/auth-server";
import { loadWebInitialNavigationMenu, loadWebInitialSessionPermissions } from "@/lib/web-navigation-server";
import * as React from "react";

export const dynamic = "force-dynamic";

export default async function RewardHubLayout({ children }: { readonly children: React.ReactNode }): Promise<React.JSX.Element> {
	const sessionActive = await hasServerSession();
	const [initialUser, initialNavigationMenu, initialSessionPermissions] = await Promise.all([
		getServerUser(),
		loadWebInitialNavigationMenu(sessionActive),
		loadWebInitialSessionPermissions(sessionActive),
	]);

	return (
		<RewardHubShell
			initialUser={initialUser}
			sessionActive={sessionActive}
			initialNavigationMenu={initialNavigationMenu}
			initialSessionPermissions={initialSessionPermissions}
		>
			{children}
		</RewardHubShell>
	);
}
