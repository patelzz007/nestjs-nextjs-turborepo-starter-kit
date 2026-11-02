import { AccessGate } from "@/contexts/identity/components/access-gate";
import { guardWebPage } from "@/contexts/identity/lib/page-guard";
import { ROUTES } from "@/lib/routes";
import { NotificationsInbox } from "@workspace/client/lib/features/notifications/notifications-inbox";
import * as React from "react";

export const dynamic = "force-dynamic";

/**
 * `/dashboard/notifications` — the customer inbox (ADR 070): every notice of this app, its unread part and
 * the archive, live over SSE. The bell's "View all" leads here.
 */
export default async function DashboardNotificationsPage(): Promise<React.JSX.Element> {
	await guardWebPage(ROUTES.dashboard.notifications);

	return (
		<AccessGate feature="your notifications">
			<NotificationsInbox settingsHref={ROUTES.dashboard.notificationSettings} />
		</AccessGate>
	);
}
