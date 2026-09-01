import { RewardHubShell } from "@/components/rewardhub/reward-hub-shell";
import { getServerUser, hasServerSession } from "@/lib/auth-server";
import * as React from "react";

export const dynamic = "force-dynamic";

export default async function RewardHubLayout({ children }: { readonly children: React.ReactNode }): Promise<React.JSX.Element> {
	const initialUser = await getServerUser();
	const sessionActive = await hasServerSession();

	return (
		<RewardHubShell initialUser={initialUser} sessionActive={sessionActive}>
			{children}
		</RewardHubShell>
	);
}
