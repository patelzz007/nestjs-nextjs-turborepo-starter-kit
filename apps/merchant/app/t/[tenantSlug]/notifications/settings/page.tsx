import { guardTenantPage } from "@/contexts/tenancy/lib/tenant/tenant-page-guard";
import { NotificationSettings } from "@workspace/client/lib/features/notifications/notification-settings";
import * as React from "react";

interface MerchantNotificationSettingsPageProps {
	readonly params: Promise<{ tenantSlug: string }>;
}

/** The member's own notification settings (ADR 070) — personal, the same whichever store is open. */
export default async function MerchantNotificationSettingsPage({ params }: MerchantNotificationSettingsPageProps): Promise<React.JSX.Element> {
	const { tenantSlug } = await params;
	const denied = await guardTenantPage(tenantSlug, "/notifications/settings");
	if (denied !== null) {
		return denied;
	}

	return <NotificationSettings />;
}
