import { BroadcastsAdminView } from "@/contexts/notifications/components/broadcasts-admin-view";

export const dynamic = "force-dynamic";

/** `/emails/broadcasts` — every broadcast, approvals and recipient reports (ADR 073). */
export default function BroadcastsAdminPage(): React.JSX.Element {
	return <BroadcastsAdminView />;
}
