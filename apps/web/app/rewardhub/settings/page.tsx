import { RewardHubSettingsView } from "@/components/rewardhub/rewardhub-settings-view";
import * as React from "react";

export const dynamic = "force-dynamic";

/** Account security settings — password and two-factor authentication. */
export default function RewardHubSettingsPage(): React.JSX.Element {
	return <RewardHubSettingsView />;
}
