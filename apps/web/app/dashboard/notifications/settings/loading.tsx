import { NotificationsInboxSkeleton } from "@workspace/client/lib/features/notifications/notifications-inbox-skeleton";
import * as React from "react";

/** `/dashboard/notifications/settings` while the server checks the session. */
export default function DashboardNotificationSettingsLoading(): React.JSX.Element {
	return <NotificationsInboxSkeleton />;
}
