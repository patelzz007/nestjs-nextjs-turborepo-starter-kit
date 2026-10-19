import { AccountSettingsSkeleton } from "@/components/loading/account-settings-skeleton";
import * as React from "react";

/** `/dashboard/account` while the server checks the session. */
export default function DashboardAccountLoading(): React.JSX.Element {
	return <AccountSettingsSkeleton />;
}
