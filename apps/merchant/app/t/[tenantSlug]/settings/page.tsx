import { TenantSettingsIndexView } from "@/contexts/tenancy/components/org/tenant-settings-index-view";
import { guardOrgPage } from "@/contexts/tenancy/lib/org/org-page-guard";
import * as React from "react";

export const dynamic = "force-dynamic";

interface TenantSettingsPageProps {
	readonly params: Promise<{ tenantSlug: string }>;
}

/** Tenant settings section index — links to team, locations, and business verification. */
export default async function TenantSettingsPage({ params }: TenantSettingsPageProps): Promise<React.JSX.Element> {
	const { tenantSlug } = await params;
	const denied = await guardOrgPage(tenantSlug, "/settings");
	if (denied !== null) {
		return denied;
	}

	return <TenantSettingsIndexView tenantSlug={tenantSlug} />;
}
