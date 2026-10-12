import { AccountSettingsSkeleton } from "@/components/loading/account-settings-skeleton";
import * as React from "react";

/** `/rewardhub/account` while the server checks the session. */
export default function RewardHubAccountLoading(): React.JSX.Element {
	return <AccountSettingsSkeleton />;
}
