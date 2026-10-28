import { TeamMemberAccessPageView } from "@/contexts/tenancy/components/access/team-member-access-page-view";
import { guardTenantPage } from "@/contexts/tenancy/lib/tenant/tenant-page-guard";
import * as React from "react";

export const dynamic = "force-dynamic";

interface TeamMemberPageProps {
	readonly params: Promise<{ tenantSlug: string; membershipId: string }>;
}

/** One member's access: their role and extra permissions. */
export default async function TeamMemberPage({ params }: TeamMemberPageProps): Promise<React.JSX.Element> {
	const { tenantSlug, membershipId } = await params;
	const denied = await guardTenantPage(tenantSlug, "/settings/team/members/[membershipId]");
	if (denied !== null) {
		return denied;
	}
	return <TeamMemberAccessPageView tenantSlug={tenantSlug} membershipId={membershipId} />;
}
