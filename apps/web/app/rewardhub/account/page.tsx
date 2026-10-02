import { AccessGate } from "@/components/auth/access-gate";
import { RewardHubSettingsView } from "@/components/rewardhub/shared/settings-view";
import * as React from "react";

export const dynamic = "force-dynamic";

/**
 * `/rewardhub/account` — personal settings: email verification, password and
 * two-factor authentication. Restricted (enrollment) sessions are sent here.
 */
export default function RewardHubAccountPage(): React.JSX.Element {
	return (
		<AccessGate feature="your account settings">
			<RewardHubSettingsView />
		</AccessGate>
	);
}
