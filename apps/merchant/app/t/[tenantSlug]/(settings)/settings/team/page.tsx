import { TenantTeamPageView } from "@/contexts/tenancy/components/tenant/tenant-team-page-view";
import { guardTenantPage } from "@/contexts/tenancy/lib/tenant/tenant-page-guard";
import * as React from "react";

export const dynamic = "force-dynamic";

interface TenantTeamPageProps {
	readonly params: Promise<{ tenantSlug: string }>;
}

/** Team roster and invitations — `merchant:manage_team`. */
export default async function TenantTeamPage({ params }: TenantTeamPageProps): Promise<React.JSX.Element> {
	const { tenantSlug } = await params;
	const denied = await guardTenantPage(tenantSlug, "/settings/team");
	if (denied !== null) {
		return denied;
	}

	return <TenantTeamPageView tenantSlug={tenantSlug} />;
}
