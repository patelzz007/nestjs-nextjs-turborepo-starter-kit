import { NotificationSettings } from "@workspace/client/lib/features/notifications/notification-settings";
import * as React from "react";

export const dynamic = "force-dynamic";

/** `/notifications/settings` — the staff member's own notification settings (ADR 070); personal, like the inbox. */
export default function AdminNotificationSettingsPage(): React.JSX.Element {
	return <NotificationSettings />;
}
