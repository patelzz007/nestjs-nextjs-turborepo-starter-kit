import { AccessGate } from "@/contexts/identity/components/access-gate";
import { guardWebPage } from "@/contexts/identity/lib/page-guard";
import { ROUTES } from "@/lib/routes";
import { NotificationSettings } from "@workspace/client/lib/features/notifications/notification-settings";
import * as React from "react";

export const dynamic = "force-dynamic";

/** `/dashboard/notifications/settings` — what reaches the customer, and where (ADR 070, 073). */
export default async function DashboardNotificationSettingsPage(): Promise<React.JSX.Element> {
	await guardWebPage(ROUTES.dashboard.notificationSettings);

	return (
		<AccessGate feature="your notification settings">
			<NotificationSettings />
		</AccessGate>
	);
}
