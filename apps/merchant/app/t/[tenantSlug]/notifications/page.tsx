import { guardTenantPage } from "@/contexts/tenancy/lib/tenant/tenant-page-guard";
import { NotificationsInbox } from "@workspace/client/lib/features/notifications/notifications-inbox";
import { tenantRoutes } from "@/lib/routes";
import * as React from "react";

interface MerchantNotificationsPageProps {
	readonly params: Promise<{ tenantSlug: string }>;
}

/**
 * The member's own merchant inbox (ADR 070): reward reviews, team and store notices — personal, the same
 * whichever store is open. Every member may open it (`ORG_PAGE_RULES`).
 */
export default async function MerchantNotificationsPage({ params }: MerchantNotificationsPageProps): Promise<React.JSX.Element> {
	const { tenantSlug } = await params;
	const denied = await guardTenantPage(tenantSlug, "/notifications");
	if (denied !== null) {
		return denied;
	}

	return <NotificationsInbox settingsHref={tenantRoutes(tenantSlug).notificationSettings} />;
}
