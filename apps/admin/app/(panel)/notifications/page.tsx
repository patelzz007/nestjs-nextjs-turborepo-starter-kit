import { NotificationsInbox } from "@workspace/client/lib/features/notifications/notifications-inbox";
import * as React from "react";

import { ROUTES } from "@/lib/routes";

export const dynamic = "force-dynamic";

/**
 * `/notifications` — the staff member's own inbox (ADR 070): every admin notice, its unread part and the
 * archive, live over SSE. Personal, so no route rule gates it; the bell's "View all" leads here.
 */
export default function AdminNotificationsPage(): React.JSX.Element {
	return <NotificationsInbox settingsHref={`${ROUTES.notifications}/settings`} />;
}
