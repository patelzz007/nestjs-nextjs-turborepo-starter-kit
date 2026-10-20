import { AccessGate } from "@/contexts/identity/components/access-gate";
import { DashboardSettingsView } from "@/components/dashboard/shared/settings-view";
import { guardWebPage } from "@/contexts/identity/lib/page-guard";
import { ROUTES } from "@/lib/routes";
import * as React from "react";

export const dynamic = "force-dynamic";

/**
 * `/dashboard/account` — personal settings: email verification, password and
 * two-factor authentication. Restricted (enrollment) sessions are sent here.
 */
export default async function DashboardAccountPage(): Promise<React.JSX.Element> {
	await guardWebPage(ROUTES.dashboard.account);

	return (
		<AccessGate feature="your account settings">
			<DashboardSettingsView />
		</AccessGate>
	);
}
