import { NotificationsInboxSkeleton } from "@workspace/client/lib/features/notifications/notifications-inbox-skeleton";
import type * as React from "react";

/** `/t/[tenantSlug]/notifications` while the page guard runs. */
export default function MerchantNotificationsLoading(): React.JSX.Element {
	return <NotificationsInboxSkeleton />;
}
