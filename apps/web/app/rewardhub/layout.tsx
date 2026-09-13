import { RewardHubShell } from "@/components/rewardhub/shared/shell";
import { getServerUser, hasServerSession } from "@/lib/auth/server";
import { loadWebInitialSessionPermissions } from "@/lib/navigation/server";
import * as React from "react";

export const dynamic = "force-dynamic";

export default async function RewardHubLayout({ children }: { readonly children: React.ReactNode }): Promise<React.JSX.Element> {
	const sessionActive = await hasServerSession();
	const [initialUser, initialSessionPermissions] = await Promise.all([getServerUser(), loadWebInitialSessionPermissions(sessionActive)]);

	return (
		<RewardHubShell initialUser={initialUser} sessionActive={sessionActive} initialSessionPermissions={initialSessionPermissions}>
			{children}
		</RewardHubShell>
	);
}
