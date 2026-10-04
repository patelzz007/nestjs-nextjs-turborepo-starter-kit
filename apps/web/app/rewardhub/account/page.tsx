import { AccessGate } from "@/components/auth/access-gate";
import { RewardHubSettingsView } from "@/components/rewardhub/shared/settings-view";
import { guardWebPage } from "@/lib/auth/page-guard";
import { ROUTES } from "@/lib/routes";
import * as React from "react";

export const dynamic = "force-dynamic";

/**
 * `/rewardhub/account` — personal settings: email verification, password and
 * two-factor authentication. Restricted (enrollment) sessions are sent here.
 */
export default async function RewardHubAccountPage(): Promise<React.JSX.Element> {
	await guardWebPage(ROUTES.rewardHub.account);

	return (
		<AccessGate feature="your account settings">
			<RewardHubSettingsView />
		</AccessGate>
	);
}
