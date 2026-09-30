import { RewardHubShell } from "@/components/rewardhub/shared/shell";
import { getServerUser, hasServerSession } from "@/lib/auth/server";
import * as React from "react";

export const dynamic = "force-dynamic";

/** Capabilities come from the root `WebAuthorizationProvider` — this layout only adds the shell. */
export default async function RewardHubLayout({ children }: { readonly children: React.ReactNode }): Promise<React.JSX.Element> {
	const [sessionActive, initialUser] = await Promise.all([hasServerSession(), getServerUser()]);

	return (
		<RewardHubShell initialUser={initialUser} sessionActive={sessionActive}>
			{children}
		</RewardHubShell>
	);
}
