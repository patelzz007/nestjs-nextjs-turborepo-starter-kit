import { TenantTeamPageView } from "@/contexts/tenancy/components/org/tenant-team-page-view";
import { guardOrgPage } from "@/contexts/tenancy/lib/org/org-page-guard";
import * as React from "react";

export const dynamic = "force-dynamic";

interface TenantTeamPageProps {
	readonly params: Promise<{ tenantSlug: string }>;
}

/** Team roster and invitations — `merchant:manage_team`. */
export default async function TenantTeamPage({ params }: TenantTeamPageProps): Promise<React.JSX.Element> {
	const { tenantSlug } = await params;
	const denied = await guardOrgPage(tenantSlug, "/settings/team");
	if (denied !== null) {
		return denied;
	}

	return <TenantTeamPageView tenantSlug={tenantSlug} />;
}
