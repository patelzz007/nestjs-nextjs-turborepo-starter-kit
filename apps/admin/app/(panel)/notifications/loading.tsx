import { NotificationsInboxSkeleton } from "@workspace/client/lib/features/notifications/notifications-inbox-skeleton";

/** `/notifications` while the panel renders. */
export default function AdminNotificationsLoading(): React.JSX.Element {
	return <NotificationsInboxSkeleton />;
}
