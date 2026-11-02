import { NotificationsInboxSkeleton } from "@workspace/client/lib/features/notifications/notifications-inbox-skeleton";
import type * as React from "react";

/** `/t/[tenantSlug]/notifications/settings` while the page guard runs. */
export default function MerchantNotificationSettingsLoading(): React.JSX.Element {
	return <NotificationsInboxSkeleton />;
}
